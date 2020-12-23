const D4ppToken = artifacts.require("D4ppToken");
const D4ppGovernance = artifacts.require("D4ppGovernance");

module.exports = async (deployer, network, [admin, user1, user2]) => {
    const toWei = _amount => web3.utils.toWei(_amount.toString(), "ether");

    await deployer.deploy(D4ppToken, "D4pp Token", "d4pp", { from: admin });
    await deployer.deploy(D4ppGovernance, D4ppToken.address, { from: admin });
}