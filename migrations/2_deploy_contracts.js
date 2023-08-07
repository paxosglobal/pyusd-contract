const PYUSD = artifacts.require('PYUSDImplementation');
const Proxy = artifacts.require('AdminUpgradeabilityProxy');

module.exports = async function(deployer) {
  await deployer;

  await deployer.deploy(PYUSD);
  const proxy = await deployer.deploy(Proxy, PYUSD.address);
  const proxiedPYUSD = await PYUSD.at(proxy.address);
  await proxy.changeAdmin("0xf0b1eef88956b0a307fa87b5f5671aad6a5d330f");
  await proxiedPYUSD.initialize();
};
