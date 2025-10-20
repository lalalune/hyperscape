import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';

const SEED_PHRASE = process.env.SEED_PHRASE || 'test test test test test test test test test test test junk';
const PASSWORD = process.env.WALLET_PASSWORD || 'Tester@1234';

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD);
  await metamask.importWallet(SEED_PHRASE);

  const jejuChainId = parseInt(process.env.CHAIN_ID || '420691');
  const jejuRpcUrl = process.env.JEJU_RPC_URL || 'http://localhost:8545';

  await walletPage.evaluate(async ([chainId, rpcUrl]) => {
    await (window as any).ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: `0x${chainId.toString(16)}`,
        chainName: 'Jeju Network',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [rpcUrl]
      }]
    });
  }, [jejuChainId, jejuRpcUrl]);

  return metamask;
});

