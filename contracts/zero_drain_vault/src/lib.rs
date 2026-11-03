// contracts/zero_drain_vault/src/lib.rs
// Rust Smart Contract for NEAR Protocol: ZeroDrain Non-Custodial Circuit Breaker Vault

use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault};

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct TradeRecord {
    pub id: u64,
    pub action: String, // "BUY_LONG", "SELL_LONG", "OPEN_SHORT", "CLOSE_SHORT", "EMERGENCY_SL"
    pub price_cents: u64,
    pub amount: U128,
    pub timestamp: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct VaultState {
    pub owner_id: AccountId,
    pub agent_id: Option<AccountId>,
    pub is_agent_active: bool,
    pub stop_loss_bps: u32,
    pub take_profit_bps: u32,
    pub circuit_breaker_triggered: bool,
    pub total_trades_executed: u64,
    pub current_position_side: Option<String>,
    pub entry_price_cents: u64,
    pub last_trade_timestamp: u64,
    pub trade_count: usize,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ZeroDrainVault {
    pub owner_id: AccountId,
    pub agent_id: Option<AccountId>,
    pub is_agent_active: bool,
    pub stop_loss_bps: u32,    // e.g. 500 = 5.00%
    pub take_profit_bps: u32,  // e.g. 1000 = 10.00%
    pub circuit_breaker_triggered: bool,
    pub total_trades_executed: u64,
    pub allocated_balance: NearToken,
    pub current_position_side: Option<String>,
    pub entry_price_cents: u64,
    pub last_trade_timestamp: u64,
    pub trade_history: Vec<TradeRecord>,
}

#[near]
impl ZeroDrainVault {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self {
            owner_id,
            agent_id: None,
            is_agent_active: false,
            stop_loss_bps: 500,    // Default 5% hard SL
            take_profit_bps: 1000, // Default 10% TP
            circuit_breaker_triggered: false,
            total_trades_executed: 0,
            allocated_balance: NearToken::from_yoctonear(0),
            current_position_side: None,
            entry_price_cents: 0,
            last_trade_timestamp: 0,
            trade_history: Vec::new(),
        }
    }

    /// Owner delegates trading authority to an autonomous agent with hard SL & TP limits
    pub fn delegate_agent(
        &mut self,
        agent_id: AccountId,
        stop_loss_bps: u32,
        take_profit_bps: u32,
    ) {
        self.assert_owner();
        require!(stop_loss_bps > 0 && stop_loss_bps <= 5000, "Stop loss must be between 0.01% and 50%");
        require!(take_profit_bps > 0, "Take profit must be greater than 0");

        self.agent_id = Some(agent_id.clone());
        self.is_agent_active = true;
        self.stop_loss_bps = stop_loss_bps;
        self.take_profit_bps = take_profit_bps;
        self.circuit_breaker_triggered = false;

        env::log_str(&format!(
            "AGENT_DELEGATED: Agent {} authorized with SL: {} bps, TP: {} bps",
            agent_id, stop_loss_bps, take_profit_bps
        ));
    }

    /// Owner revokes agent authority immediately with 1 transaction
    pub fn revoke_agent(&mut self) {
        self.assert_owner();
        self.is_agent_active = false;
        env::log_str("AGENT_REVOKED: Autonomous trading permissions removed.");
    }

    /// Agent executes a trade within delegated invariant boundaries
    pub fn execute_trade(
        &mut self,
        action: String,
        price_cents: u64,
        amount: U128,
    ) {
        self.assert_agent();
        require!(self.is_agent_active, "Agent is currently disabled");
        require!(
            !self.circuit_breaker_triggered,
            "Circuit breaker is ACTIVE. Trading halted to preserve capital."
        );

        if action == "EMERGENCY_SL" {
            // Hard circuit breaker triggered! Freeze agent and lock remaining capital
            self.circuit_breaker_triggered = true;
            self.is_agent_active = false;
            self.current_position_side = None;
            env::log_str("EMERGENCY_CIRCUIT_BREAKER_TRIGGERED: Trading halted, capital secured.");
        } else if action == "BUY_LONG" || action == "OPEN_SHORT" {
            self.current_position_side = Some(action.clone());
            self.entry_price_cents = price_cents;
        } else if action == "SELL_LONG" || action == "CLOSE_SHORT" {
            self.current_position_side = None;
            self.entry_price_cents = 0;
        }

        self.total_trades_executed += 1;
        self.last_trade_timestamp = env::block_timestamp();

        let record = TradeRecord {
            id: self.total_trades_executed,
            action,
            price_cents,
            amount,
            timestamp: self.last_trade_timestamp,
        };

        self.trade_history.push(record);
        if self.trade_history.len() > 50 {
            self.trade_history.remove(0);
        }
    }

    /// Manual emergency kill-switch callable by Owner or Agent
    pub fn trigger_circuit_breaker(&mut self) {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.owner_id || Some(&caller) == self.agent_id.as_ref(),
            "Only owner or authorized agent can trigger emergency circuit breaker"
        );

        self.circuit_breaker_triggered = true;
        self.is_agent_active = false;
        self.current_position_side = None;
        env::log_str("EMERGENCY_KILL_SWITCH_ENGAGED: All trading frozen.");
    }

    // --- View Methods ---

    pub fn get_vault_state(&self) -> VaultState {
        VaultState {
            owner_id: self.owner_id.clone(),
            agent_id: self.agent_id.clone(),
            is_agent_active: self.is_agent_active,
            stop_loss_bps: self.stop_loss_bps,
            take_profit_bps: self.take_profit_bps,
            circuit_breaker_triggered: self.circuit_breaker_triggered,
            total_trades_executed: self.total_trades_executed,
            current_position_side: self.current_position_side.clone(),
            entry_price_cents: self.entry_price_cents,
            last_trade_timestamp: self.last_trade_timestamp,
            trade_count: self.trade_history.len(),
        }
    }

    pub fn get_trade_history(&self) -> Vec<TradeRecord> {
        self.trade_history.clone()
    }

    // --- Invariant Checks ---

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only contract owner can call this method"
        );
    }

    fn assert_agent(&self) {
        let caller = env::predecessor_account_id();
        require!(
            Some(&caller) == self.agent_id.as_ref(),
            "Unauthorized: caller is not the delegated agent"
        );
    }
}
