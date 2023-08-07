pragma solidity ^0.4.24;

import "../PYUSDImplementation.sol";


contract PYUSDWithBalance is PYUSDImplementation {
    function initializeBalance(address initialAccount, uint initialBalance) public {
        balances[initialAccount] = initialBalance;
        totalSupply_ = initialBalance;
    }
}
