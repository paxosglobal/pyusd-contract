# PayPal USD (PYUSD)

Paxos-issued USD-collateralized ERC20 stablecoin public smart contract repository.

https://github.com/paxosglobal/pyusd-contract

## ABI, Address, and Verification

The contract abi is in `PYUSD.abi`. It is the abi of the implementation contract.
Interaction with PayPal USD is done at the address of the proxy at `0x6c3ea9036406852006290770bedfcaba0e23a0e8`. See
https://etherscan.io/token/0x6c3ea9036406852006290770bedfcaba0e23a0e8 for live on-chain details, and the section on bytecode verification below.

## Audits
The initial independent security audit was conducted by Trail of Bits and the audit report can be found [here](audit-reports/Trail_of_Bits_Audit_Report.pdf).

Additional audits were performed by Zellic and Trail of Bits.  Audits can be found [here](https://github.com/paxosglobal/paxos-token-contracts/blob/master/audits/).

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

PYUSD uses a separately deployed `SupplyControl` contract to control the token supply. `SupplyControl` has a `SUPPLY_CONTROLLER_MANAGER_ROLE` which is responsible for managing addresses with the `SUPPLY_CONTROLLER_ROLE`, referred
to as supplyControllers. Only supplyControllers can mint and burn tokens. SupplyControllers can optionally have rate 
limits to limit how many tokens can be minted over a given time frame.

`SupplyControl` also includes functions to get all of the supply controller addresses
and get configuration for a specific supply controller.

### Pausing the contract

In the event of a critical security threat, Paxos has the ability to pause transfers
and approvals of the PYUSD token. The ability to pause is controlled by a single `owner` role,
following OpenZeppelin's
[Ownable](https://github.com/OpenZeppelin/openzeppelin-solidity/blob/5daaf60d11ee2075260d0f3adfb22b1c536db983/contracts/ownership/Ownable.sol).
The simple model for pausing transfers following OpenZeppelin's
[Pausable](https://github.com/OpenZeppelin/openzeppelin-solidity/blob/5daaf60d11ee2075260d0f3adfb22b1c536db983/contracts/lifecycle/Pausable.sol).

While paused, the supply controller retains the ability to mint and burn tokens.

### Asset Protection Role

The `ASSET_PROTECTION_ROLE` can freeze and unfreeze the token balance of any address on chain.
It can also wipe the balance of an address after it is frozen
to allow the appropriate authorities to seize the backing assets.

Freezing is something that Paxos will not do on its own accord,
and as such we expect to happen extremely rarely. Checking if an address is frozen is possible
via `isFrozen(address who)`.

### Delegate Transfer 

To facilitate gas-less transactions, we have implemented [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) and [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612).

#### EIP-3009
The public functions, `transferWithAuthorization` and `transferWithAuthorizationBatch` (for multiple transfers request), allows a spender(delegate) to transfer tokens on behalf of the sender, with condition that a signature, conforming to [EIP-712](https://eips.ethereum.org/EIPS/eip-712), is provided by the respective sender.

 ```
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

function transferWithAuthorizationBatch(
    address[] memory from,
    address[] memory to,
    uint256[] memory value,
    uint256[] memory validAfter,
    uint256[] memory validBefore,
    bytes32[] memory nonce,
    uint8[] memory v,
    bytes32[] memory r,
    bytes32[] memory s
) external;
 ```

#### EIP-2612
The sender can establish an allowance for the spender using the permit function, which employs an EIP-712 signature for authorization. Subsequently, the spender can employ the `transferFrom` and `transferFromBatch` functions to initiate transfers on behalf of the sender.

```
function permit(
    address owner,
    address spender,
    uint value,
    uint deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

function transferFrom(
    address _from,
    address _to,
    uint256 _value
) public returns (bool);

function transferFromBatch(
    address[] calldata _from,
    address[] calldata _to,
    uint256[] calldata _value
) public returns (bool);
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
- Proxy: https://etherscan.io/token/0x6c3ea9036406852006290770bedfcaba0e23a0e8
- Implementation: https://etherscan.io/token/0x8EcaE0B0402E29694B3Af35d5943D4631Ee568dC

The SupplyControl contract and implementation contracts are verified on etherscan at the following links:
- Proxy: https://etherscan.io/address/0x31d9bDEa6F104606C954f8FE6ba614F1BD347Ec3
- Implementation: https://etherscan.io/address/0xFaB5891ED867a1195303251912013b92c4fc3a1D

## Paxos Support

Visit Paxos [PYUSD](https://paxos.com/PYUSD/) website for more information.

### Testnet Faucet

Paxos [Faucet](https://faucet.paxos.com/) to get PYUSD on testnet.

### Solana

PYUSD is also available in Solana network. You can interact with the PYUSD token at the [address](https://explorer.solana.com/address/2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo): `2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo`.

## Contract Tests
Install dependencies:

`npm install`

Compile the contracts:

`npm run compile`

Run unit tests:

`npm run test`

Check test coverage:

`npm run coverage`
