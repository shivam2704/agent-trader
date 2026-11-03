use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub enum OrderStatus {
    Armed,
    Settled,
    LiquidatedSl,
    UserCancelled,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct VaultOrder {
    pub order_id: String,
    pub owner_id: AccountId,
    pub return_wallet: AccountId,
    pub target_token: String,
    pub deposit_amount: NearToken,
    pub sl_basis_points: u32,
    pub tp_basis_points: u32,
    pub trailing_stop: bool,
    pub status: OrderStatus,
    pub created_at: u64,
    pub settled_at: Option<u64>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ZeroDrainVault {
    pub admin_relayer: AccountId,
    pub orders: LookupMap<String, VaultOrder>,
    pub order_ids: Vec<String>,
    pub total_settled_orders: u64,
}

#[near]
impl ZeroDrainVault {
    #[init]
    pub fn new(admin_relayer: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self {
            admin_relayer,
            orders: LookupMap::new(b"o"),
            order_ids: Vec::new(),
            total_settled_orders: 0,
        }
    }

    /// 1. Deposit & Arm Circuit Breaker Vault
    /// Invoked by External AI Agent with attached NEAR deposit.
    /// The deposit amount and return wallet are locked on-chain.
    #[payable]
    pub fn deposit_and_arm(
        &mut self,
        order_id: String,
        target_token: String,
        sl_basis_points: u32,
        tp_basis_points: u32,
        trailing_stop: Option<bool>,
        return_wallet: Option<AccountId>,
    ) -> VaultOrder {
        let deposit = env::attached_deposit();
        require!(
            deposit > NearToken::from_yoctonear(0),
            "Requires positive NEAR deposit to arm circuit breaker"
        );
        require!(
            !self.orders.contains_key(&order_id),
            "Order ID already exists in vault"
        );

        let caller = env::predecessor_account_id();
        let destination_wallet = return_wallet.unwrap_or_else(|| caller.clone());

        let order = VaultOrder {
            order_id: order_id.clone(),
            owner_id: caller,
            return_wallet: destination_wallet,
            target_token,
            deposit_amount: deposit,
            sl_basis_points,
            tp_basis_points,
            trailing_stop: trailing_stop.unwrap_or(false),
            status: OrderStatus::Armed,
            created_at: env::block_timestamp(),
            settled_at: None,
        };

        self.orders.insert(&order_id, &order);
        self.order_ids.push(order_id);

        env::log_str(&format!(
            "ARMED: Order {} deposited {} NEAR. Locked return wallet: {}",
            order.order_id,
            deposit.as_yoctonear(),
            order.return_wallet
        ));

        order
    }

    /// 2. Autonomous Settlement / Liquidation by Relayer Bot
    /// Only the authorized admin relayer bot can trigger settlement,
    /// BUT the contract guarantees funds can ONLY transfer to order.return_wallet!
    pub fn settle_circuit_breaker(
        &mut self,
        order_id: String,
        returned_amount: U128,
        exit_reason: String,
    ) -> Promise {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.admin_relayer,
            "Only authorized ZeroDrain relayer can execute settlement"
        );

        let mut order = self
            .orders
            .get(&order_id)
            .expect("Order ID not found in vault");

        match order.status {
            OrderStatus::Armed => {}
            _ => env::panic_str("Order is not currently active in Armed state"),
        }

        let refund_token = NearToken::from_yoctonear(returned_amount.0);
        let contract_balance = env::account_balance();
        require!(
            refund_token <= contract_balance,
            "Insufficient vault contract balance for settlement"
        );

        if exit_reason.contains("SL") || exit_reason.contains("CIRCUIT") {
            order.status = OrderStatus::LiquidatedSl;
        } else {
            order.status = OrderStatus::Settled;
        }
        order.settled_at = Some(env::block_timestamp());

        self.orders.insert(&order_id, &order);
        self.total_settled_orders += 1;

        env::log_str(&format!(
            "SETTLED: Order {} returned {} yoctoNEAR strictly to {}. Reason: {}",
            order_id,
            refund_token.as_yoctonear(),
            order.return_wallet,
            exit_reason
        ));

        // Immutable on-chain guarantee: funds transfer directly to return_wallet
        Promise::new(order.return_wallet).transfer(refund_token)
    }

    /// 3. User Emergency Exit / Cancel
    /// If the bot ever stops or user wants their funds back immediately,
    /// ONLY the original owner who deposited can cancel and withdraw.
    pub fn emergency_cancel(&mut self, order_id: String) -> Promise {
        let caller = env::predecessor_account_id();
        let mut order = self
            .orders
            .get(&order_id)
            .expect("Order ID not found in vault");

        require!(
            caller == order.owner_id,
            "Only the order owner can execute emergency cancel"
        );

        match order.status {
            OrderStatus::Armed => {}
            _ => env::panic_str("Order is not in Armed state"),
        }

        order.status = OrderStatus::UserCancelled;
        order.settled_at = Some(env::block_timestamp());
        self.orders.insert(&order_id, &order);

        let refund = order.deposit_amount;
        env::log_str(&format!(
            "CANCELLED: Order {} emergency cancelled by owner. Refunding {} yoctoNEAR to {}",
            order_id,
            refund.as_yoctonear(),
            order.return_wallet
        ));

        Promise::new(order.return_wallet).transfer(refund)
    }

    /// Read-only View Methods
    pub fn get_order(&self, order_id: String) -> Option<VaultOrder> {
        self.orders.get(&order_id)
    }

    pub fn get_orders(&self, from_index: u64, limit: u64) -> Vec<VaultOrder> {
        let total = self.order_ids.len() as u64;
        if from_index >= total {
            return Vec::new();
        }
        self.order_ids
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .filter_map(|id| self.orders.get(id))
            .collect()
    }

    pub fn get_admin_relayer(&self) -> AccountId {
        self.admin_relayer.clone()
    }

    pub fn get_total_settled_orders(&self) -> u64 {
        self.total_settled_orders
    }
}
