# PayPal USD (PYUSD)

Paxos-issued USD-collateralized ERC20 stablecoin public smart contract repository.

https://github.com/paxosglobal/pyusd-contract

## ABI, Address, and Verification

The contract abi is in `PYUSD.abi`. It is the abi of the implementation contract.
Interaction with PayPal USD is done at the address of the proxy at `0x6c3ea9036406852006290770bedfcaba0e23a0e8`. See
https://etherscan.io/token/0x6c3ea9036406852006290770bedfcaba0e23a0e8 for live on-chain details, and the section on bytecode verification below.
Additionally, an independent security audit was conducted by Trail of Bits and the audit report can be found [here](audit-reports/Trail_of_Bits_Audit_Report.pdf), referenced under the original code name Token Hopper/XYZ.

## Contract Specification

PayPal USD (PYUSD) is an ERC20 token that is Centrally Minted and Burned by Paxos,
representing the trusted party backing the token with USD.

### ERC20 Token

The public interface of PayPal USD is the ERC20 interface
specified by [EIP-20](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md).

- `name()`
- `symbol()`
- `decimals()`
- `totalSupply()`
- `balanceOf(address who)`
- `transfer(address to, uint256 value)`
- `approve(address spender, uint256 value)`
- `increaseApproval(address spender, uint256 addedValue)`
- `decreaseApproval(address spender, uint256 subtractedValue)`
- `allowance(address owner, address spender)`
- `transferFrom(address from, address to, uint256 value)`

And the usual events.

- `event Transfer(address indexed from, address indexed to, uint256 value)`
- `event Approval(address indexed owner, address indexed spender, uint256 value)`

Typical interaction with the contract will use `transfer` to move the token as payment.
Additionally, a pattern involving `approve` and `transferFrom` can be used to allow another
address to move tokens from your address to a third party without the need for the middleperson
to custody the tokens, such as in the 0x protocol.

#### Warning about ERC20 approve front-running

[There is a well known gotcha](https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729) involving the ERC20
`approve` method. The problem occurs when the owner decides to change the allowance of a spender that already has an
allowance. If the spender sends a `transferFrom` transaction at a similar time that the owner sends the new `approve`
transaction and the `transferFrom` by the spender goes through first, then the spender gets to use the original
allowance, and also get approved for the intended new allowance.

To mitigate this risk, we recommend that smart contract users utilize the alternative functions `increaseApproval` and
`decreaseApproval` instead of using `approve` directly.

### Controlling the token supply

The total supply of PYUSD is backed by US dollar fiat held in reserve by Paxos Trust Company.
There is a single `supplyController` address that can mint and burn the token
based on the actual movement of cash in and out of the reserve based on
requests for the purchase and redemption of PYUSD.

The supply control interface includes methods to get the current address
of the supply controller, and events to monitor the change in supply of PYUSD.

- `supplyController()`

Supply Control Events

- `SupplyIncreased(address indexed to, uint256 value)`
- `SupplyDecreased(address indexed from, uint256 value)`
- `SupplyControllerSet(address indexed oldSupplyController, address indexed newSupplyController)`

### Pausing the contract

In the event of a critical security threat, Paxos has the ability to pause transfers
and approvals of the PYUSD token. The ability to pause is controlled by a single `owner` role,
following OpenZeppelin's
[Ownable](https://github.com/OpenZeppelin/openzeppelin-solidity/blob/5daaf60d11ee2075260d0f3adfb22b1c536db983/contracts/ownership/Ownable.sol).
The simple model for pausing transfers following OpenZeppelin's
[Pausable](https://github.com/OpenZeppelin/openzeppelin-solidity/blob/5daaf60d11ee2075260d0f3adfb22b1c536db983/contracts/lifecycle/Pausable.sol).

While paused, the supply controller retains the ability to mint and burn tokens.

### Asset Protection Role

Paxos Trust Company is regulated by the New York Department of Financial Services (NYDFS). As required by the regulator,
Paxos must have a role for asset protection to freeze or seize the assets of a criminal party when required to do so by
law, including by court order or other legal process.

The `assetProtectionRole` can freeze and unfreeze the PYUSD balance of any address on chain.
It can also wipe the balance of an address after it is frozen
to allow the appropriate authorities to seize the backing assets.

Freezing is something that Paxos will not do on its own accord,
and as such we expect to happen extremely rarely. The list of frozen addresses is available
in `isFrozen(address who)`.

### BetaDelegateTransfer

In order to allow for gas-less transactions we have implemented a variation of [EIP-865](https://github.com/ethereum/EIPs/issues/865).
The public function betaDelegatedTransfer and betaDelegatedTransferBatch allow an approved party to transfer PYUSD
on the end user's behalf given a signed message from said user. Because EIP-865 is not finalized,
all methods related to delegated transfers are prefixed by Beta. Only approved parties are allowed to transfer
PYUSD on a user's behalf because of potential attacks associated with signing messages.
To mitigate some attacks, [EIP-712](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md)
is implemented which provides a structured message to be displayed for verification when signing.
 ```
 function betaDelegatedTransfer(
    bytes sig, address to, uint256 value, uint256 fee, uint256 seq, uint256 deadline
 ) public returns (bool) {
 ```

### Upgradeability Proxy

To facilitate upgradeability on the immutable blockchain we follow a standard
two-contract delegation pattern: a proxy contract represents the token,
while all calls not involving upgrading the contract are delegated to an
implementation contract.

The delegation uses `delegatecall`, which runs the code of the implementation contract
_in the context of the proxy storage_. This way the implementation pointer can
be changed to a different implementation contract while still keeping the same
data and PYUSD contract address, which are really for the proxy contract.

The proxy used here is AdminUpgradeabilityProxy from ZeppelinOS.

## Upgrade Process

The implementation contract is only used for the logic of the non-admin methods.
A new implementation contract can be set by calling `upgradeTo()` or `upgradeToAndCall()` on the proxy,
where the latter is used for upgrades requiring a new initialization or data migration so that
it can all be done in one transaction. You must first deploy a copy of the new implementation
contract, which is automatically paused by its constructor to help avoid accidental calls directly
to the proxy contract.

## Bytecode verification

The proxy contract and implementation contracts are verified on etherscan at the following links:
https://etherscan.io/token/0x6c3ea9036406852006290770bedfcaba0e23a0e8
https://etherscan.io/token/0xe17b8aDF8E46b15f3F9aB4Bb9E3b6e31Db09126E

## Contract Tests

`make setup`

To run smart contract tests first start ganache-cli

`make ganache`

in another terminal

Then run

`make test-contracts`

You can also run `make test-contracts-coverage` to see a coverage report.