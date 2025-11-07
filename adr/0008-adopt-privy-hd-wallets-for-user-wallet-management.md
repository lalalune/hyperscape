# 0008. Adopt Privy HD Wallets for User Wallet Management

Date: 2025-11-06

## Status

Accepted

## Context

Hyperscape is evolving into a Web3-enabled virtual world where players can own digital assets, trade items, and interact with blockchain-based economies. The platform needs a secure, user-friendly wallet solution that supports both traditional gamers (unfamiliar with crypto) and Web3-native users.

### Current Situation
- Authentication handled by Privy (industry-standard OAuth/social login)
- Need for blockchain wallet integration for:
  - NFT ownership (avatars, items, land)
  - In-game economy and trading
  - Token-gated features and events
  - Asset portability across platforms
  - Player-to-player transactions
- User base includes both crypto-native and crypto-unfamiliar players

### Pain Points with Traditional Wallet Solutions
- **Onboarding friction**: Users must install MetaMask, create seed phrases, understand gas
- **Lost seed phrases**: Users lose access to wallets permanently
- **Security burden**: Users responsible for seed phrase security
- **Poor UX**: Constant wallet popups, transaction signing confusion
- **Mobile complexity**: Browser extension wallets don't work well on mobile
- **Multi-wallet management**: Hard to manage multiple wallets per user
- **Cross-platform**: Desktop wallets don't sync with mobile

### Requirements
- **Embedded wallets** - Wallets managed by the platform, no seed phrase burden
- **Social login integration** - Works with existing Privy OAuth authentication
- **Multi-wallet support** - Users can have multiple wallets (main, alt accounts, trading)
- **Multi-chain support** - Ethereum (EVM) and Solana compatibility
- **Security** - Industry-standard cryptography and key management
- **Mobile-first** - Works seamlessly on web and mobile (iOS/Android)
- **Web3 library compatibility** - Works with ethers, viem, web3.js
- **Gradual Web3 exposure** - Hide complexity from new users, expose power to advanced users
- **Wallet export** - Users can export private keys if they want self-custody
- **Developer experience** - Simple API for wallet creation, signing, transactions

### Drivers
- **Player onboarding** - Remove crypto complexity from new player signup
- **Asset ownership** - Enable true digital ownership of in-game items
- **Trading economy** - Facilitate peer-to-peer trading with blockchain settlement
- **Cross-platform play** - Same wallet/assets accessible from web, iOS, Android
- **Future-proofing** - Position for token launches, NFT drops, DAO governance

## Decision

We will **adopt Privy's Hierarchical Deterministic (HD) embedded wallets** as the wallet management solution for Hyperscape, providing secure, user-friendly blockchain wallets integrated with our existing Privy authentication.

### Key Points
- **Hierarchical wallet architecture**: Main account wallet (HD Index 0) funds character wallets (HD Index 1+)
- **Automatic embedded wallet creation** on user login (Ethereum + Solana)
- Create embedded wallets for **all users**, even those with external wallets
- **Main account wallet**: Funding source, receives deposits from exchanges/external wallets
- **Character wallets**: In-game wallets, one per character, funded by main account
- **External wallet support** enabled for Ethereum wallets (MetaMask, Coinbase, etc.)
- Specifically configured for **Farcaster wallet** integration
- **Multi-chain support**: Both Ethereum and Solana embedded wallets
- HD wallet derivation for multiple wallets per user
- Wallet export functionality for self-custody
- Works with Privy modal login and external wallet connections

### Implementation Details

**Privy Dashboard Configuration:**

```
Embedded Wallets:
☑ Automatically create embedded wallets on login
  - Privy creates wallets when users sign up
  - Applies to Privy modal login

☑ Ethereum (EVM wallets)
  - Auto-create Ethereum embedded wallets

☑ Solana (Solana wallets)
  - Auto-create Solana embedded wallets

☑ Create embedded wallets for all users, even if they have linked external wallets
  - Ensures every user has embedded wallet regardless of external wallet status

External Wallets:
☑ Let users sign in with third-party wallets
  - MetaMask, Coinbase, browser extensions, hardware, mobile app wallets

☑ Ethereum (Ethereum wallets)
  - Enable external Ethereum wallet connections
  - For Farcaster wallet integration
```

**Hierarchical Wallet Creation Flow:**
```typescript
import {usePrivy, useWallets} from '@privy-io/react-auth';
import {useCreateWallet} from '@privy-io/react-auth';

// Step 1: User logs in (email, wallet, or Farcaster)
// Main account wallets (HD Index 0) are AUTO-CREATED for both ETH and SOL

const {wallets} = useWallets();

// Main account wallets (auto-created on login)
const mainEthWallet = wallets.find(
  w => w.walletClientType === 'privy' &&
       w.chainType === 'ethereum' &&
       w.walletIndex === 0
);

const mainSolWallet = wallets.find(
  w => w.walletClientType === 'privy' &&
       w.chainType === 'solana' &&
       w.walletIndex === 0
);

// Step 2: User creates a character
// Create character wallet (HD Index 1)
const {createWallet} = useCreateWallet();

// Create Ethereum character wallet
const characterEthWallet = await createWallet({
  createAdditional: true, // HD Index 1
});

// Create Solana character wallet (if using Solana)
import {useCreateWallet as useCreateSolanaWallet} from '@privy-io/react-auth/solana';
const {createWallet: createSolWallet} = useCreateSolanaWallet();
const characterSolWallet = await createSolWallet({
  createAdditional: true, // HD Index 1
});

// Step 3: Fund character wallet from main account
// Transfer funds from main account to character wallet
// (Implementation depends on chain and token type)

// Step 4: External wallet connections (optional)
// Users can also connect MetaMask or Farcaster wallet to fund main account
const {connectWallet} = usePrivy();
await connectWallet();
```

**Wallet Types:**
- **Main Account Embedded Wallet**: HD Index 0, auto-created, funding source
- **Character Embedded Wallet**: HD Index 1+, created on character creation, in-game use
- **External Wallets**: User-connected (MetaMask, Coinbase, Farcaster), can fund main account

**HD Derivation Paths:**
- Ethereum: `m/44'/60'/0'/0/i` (where i = wallet index)
- Solana: `m/44'/501'/i/0'`

**Environment Configuration:**
```bash
# packages/client/.env
PUBLIC_PRIVY_APP_ID=cl...
PUBLIC_PRIVY_APP_SECRET=...

# Enable Farcaster integration
PUBLIC_ENABLE_FARCASTER=true
```

**Privy SDK Integration:**
```typescript
// packages/client/src/components/PrivyProvider.tsx
import {PrivyProvider} from '@privy-io/react-auth';

<PrivyProvider
  appId={process.env.PUBLIC_PRIVY_APP_ID}
  config={{
    embeddedWallets: {
      createOnLogin: 'all-users', // Auto-create for all users
      requireUserPasswordOnCreate: false, // Seamless creation
      noPromptOnSignature: false, // Prompt for signatures
    },
    loginMethods: ['email', 'wallet', 'farcaster'],
    supportedChains: [
      // Ethereum chains
      mainnet, polygon, arbitrum, base,
      // Solana
      solana
    ],
    defaultChain: mainnet, // or polygon
  }}
>
  {children}
</PrivyProvider>
```

**Supported Chains:**
- **Ethereum Mainnet**: Primary EVM chain
- **Polygon**: Low-cost EVM transactions
- **Arbitrum**: Layer 2 scaling
- **Base**: Coinbase L2
- **Solana**: High-throughput, low-cost transactions

## Alternatives Considered

### Alternative 1: Self-Custody Wallets (MetaMask, Rainbow, etc.)
**Pros:**
- True decentralization
- User owns private keys
- No platform dependency
- Familiar to crypto-native users
- Standard Web3 experience

**Cons:**
- **Major onboarding friction** - Install extension, create seed, learn concepts
- Lost seed phrases mean lost wallets
- Poor mobile experience
- Transaction signing confusion for new users
- Can't serve non-crypto-native gamers
- No built-in multi-wallet support

**Reason for rejection:** Self-custody wallets are perfect for crypto-native users but create massive onboarding friction for traditional gamers. Hyperscape targets both audiences. Privy embedded wallets provide simplicity for newcomers while allowing export to self-custody for advanced users.

### Alternative 2: Magic Link (magic.link)
**Pros:**
- Email-based authentication
- Embedded wallet solution
- Good developer experience
- Multi-chain support

**Cons:**
- Different auth provider than Privy (we already use Privy)
- Requires separate authentication integration
- Less flexible multi-wallet support
- Higher cost at scale
- Smaller ecosystem than Privy
- Would require replacing existing Privy auth

**Reason for rejection:** Magic is a strong alternative but would require replacing our existing Privy authentication infrastructure (ADR-0001 references Privy for auth). Consolidating auth + wallets with Privy provides better integration and lower complexity.

### Alternative 3: Web3Auth (web3auth.io)
**Pros:**
- Social login with embedded wallets
- Multi-chain support
- Non-custodial (MPC + TSS)
- Good documentation

**Cons:**
- Complex setup (node management, TSS)
- Different auth system from Privy
- More expensive at scale
- Steeper learning curve
- Would replace existing Privy infrastructure

**Reason for rejection:** Web3Auth is powerful but overengineered for Hyperscape's needs. We already use Privy for authentication; adding Web3Auth would introduce complexity without significant benefit.

### Alternative 4: WalletConnect + Account Abstraction
**Pros:**
- Standards-based (ERC-4337)
- Gasless transactions
- Social recovery
- Multi-device support

**Cons:**
- **Complex implementation** - Smart contract wallets, bundlers, paymasters
- Not yet production-ready for gaming
- Higher transaction costs (smart contract overhead)
- Limited wallet provider support
- Unclear Solana support
- Significant development effort

**Reason for rejection:** Account Abstraction (ERC-4337) is the future but not yet mature for production gaming. Implementation complexity far exceeds benefit. Privy provides similar UX benefits (embedded wallets, social login) without AA complexity.

### Alternative 5: Coinbase Wallet SDK
**Pros:**
- Trusted brand (Coinbase)
- Good mobile experience
- Multi-chain support
- Self-custody option

**Cons:**
- Tied to Coinbase ecosystem
- Limited customization
- User still needs Coinbase account
- Not truly embedded (redirects to Coinbase app)
- Less control over UX

**Reason for rejection:** Coinbase Wallet SDK is a solid solution but lacks the seamless embedded wallet experience of Privy. Users still need a Coinbase account, reducing onboarding simplicity.

## Consequences

### Positive
- **Automatic wallet creation** - Every user gets wallets automatically on login
- **Multi-chain support** - Both Ethereum and Solana embedded wallets
- **Flexible authentication** - Email, external wallet, or Farcaster login
- **External wallet compatibility** - Users can connect MetaMask, Coinbase, etc.
- **Farcaster integration** - Social wallet connections for Farcaster users
- **Mobile-first** - Works seamlessly on iOS, Android, web
- **Security** - Enterprise-grade key management by Privy
- **Developer experience** - Simple React hooks (`useCreateWallet`, `useWallets`)
- **Web3 compatibility** - Works with ethers, viem, web3.js via EIP-1193 provider
- **HD wallet support** - Multiple wallets per user via derivation paths
- **Export capability** - Users can migrate to self-custody anytime
- **Cross-platform** - Same wallet across all Hyperscape platforms
- **Chain flexibility** - Support for mainnet, Polygon, Arbitrum, Base, Solana

### Negative
- **Platform dependency** - Wallets managed by Privy infrastructure
- **Cost** - Privy charges per monthly active wallet (MAW) per chain
- **Centralization concerns** - Not true self-custody (though export is available)
- **Privy vendor lock-in** - Migration would require user wallet exports
- **Limited blockchain support** - Only chains Privy supports (configurable set)
- **Key management trust** - Users must trust Privy's cryptosystem
- **Dual wallet management** - Users may have both embedded + external wallets

### Neutral
- Users can export to self-custody anytime (best of both worlds)
- Privy handles wallet recovery (not decentralized but practical)
- Wallet creation requires user interaction (can't create silently)
- HD wallets mean deterministic addresses (privacy consideration)

### Risks
- **Risk 1: Privy service outage**
  - Mitigation: Privy has 99.9% uptime SLA, redundant infrastructure
  - Fallback: Users can export wallets and use self-custody
  - Assessment: Low risk - Privy is production-grade, used by major apps

- **Risk 2: Privy pricing increases**
  - Mitigation: Export wallets to self-custody, migrate to alternative
  - Negotiation: Volume discounts available for growing apps
  - Assessment: Medium risk - monitor costs as user base grows

- **Risk 3: User confusion about custody**
  - Mitigation: Clear UI explaining embedded wallets vs. self-custody
  - Education: In-game tutorials about wallet ownership
  - Transparency: Prominent export option for advanced users

- **Risk 4: Blockchain not supported by Privy**
  - Mitigation: Request chain support from Privy (responsive to customer needs)
  - Workaround: Use self-custody wallet for unsupported chains
  - Assessment: Low risk - Privy supports major chains (ETH, Polygon, Arbitrum, Solana)

- **Risk 5: Regulatory changes around custodial wallets**
  - Mitigation: Privy handles compliance, we're not custodians
  - User control: Export functionality maintains user sovereignty
  - Assessment: Low risk - Privy is compliant, not a custodial service

## Implementation

### Action Items
- [x] Privy authentication integrated (already done)
- [ ] Configure Privy Dashboard settings:
  - [x] Enable automatic embedded wallet creation on login
  - [x] Enable Ethereum embedded wallets
  - [x] Enable Solana embedded wallets
  - [x] Enable "create for all users" option
  - [x] Enable external wallet connections
  - [x] Enable Farcaster wallet support
- [ ] Configure supported chains (Mainnet, Polygon, Arbitrum, Base, Solana)
- [ ] Implement multi-chain wallet detection and selection UI
- [ ] Integrate external wallet connection flow (MetaMask, Coinbase)
- [ ] Test Farcaster wallet integration
- [ ] Implement wallet signing for in-game transactions
- [ ] Create wallet export flow for self-custody users
- [ ] Test HD wallet creation (additional wallets)
- [ ] Test cross-platform wallet access (web, iOS, Android)
- [ ] Document wallet configuration for team
- [ ] Set up wallet analytics and monitoring

### Timeline
- **Nov 2025**: ADR documented, Privy configuration
- **Dec 2025**: Embedded wallet auto-creation enabled (ETH + SOL)
- **Q1 2026**: External wallet integration (MetaMask, Coinbase, Farcaster)
- **Q2 2026**: Multi-chain support expansion (Base, Arbitrum)
- **Ongoing**: Additional wallet features, HD wallet usage

### Success Metrics
- [ ] 90%+ of new users complete wallet creation - **TARGET**
- [ ] < 5% user drop-off due to wallet complexity - **TARGET**
- [ ] 100% cross-platform wallet access - **TARGET**
- [ ] < 2 second wallet creation time - **TARGET**
- [ ] < 0.1% wallet-related support tickets - **TARGET**

## References

- [Privy HD Wallets Documentation](https://docs.privy.io/guide/react/wallets/embedded/hd-wallets)
- [Privy React SDK](https://docs.privy.io/guide/react)
- [Privy Expo SDK](https://docs.privy.io/guide/expo)
- packages/client/.env - PRIVY_APP_ID configuration
- packages/server/.env - PRIVY_APP_SECRET configuration
- CLAUDE.md - Security protocols mentioning Privy

## Notes

**Privy is already integrated** for authentication, as referenced in:
- CLAUDE.md security-protocols.mdc: "All authentication handled by Privy (industry-standard)"
- PROJECT_CONTEXT.md: "Privy (authentication)" in environment variables
- Multiple .env references to PRIVY_APP_ID and PRIVY_APP_SECRET

**This ADR extends existing Privy integration** from authentication to wallets.

**HD Wallet Architecture:**
Privy's HD wallets use BIP-39 (mnemonic) and BIP-44 (derivation paths):
- Single seed protected by Privy cryptosystem
- Deterministic wallet generation (same seed → same wallets)
- User can export seed phrase for self-custody
- Each wallet has unique address but derived from shared entropy

**Hierarchical Wallet Architecture:**

Hyperscape implements a two-tier wallet system using HD wallet indices:

```
Main Account Wallet (HD Index 0)
    ↓ (funds)
Character Wallet 1 (HD Index 1)
Character Wallet 2 (HD Index 2) [Future multi-character]
Character Wallet 3 (HD Index 3) [Future multi-character]
```

**Wallet Roles:**

1. **Main Account Wallet (HD Index 0)**
   - Auto-created on first login (both ETH and SOL versions)
   - User's funding source from external sources (Coinbase, exchanges)
   - Transfers assets to character wallets
   - Managed via account settings, not exposed in-game
   - Can be funded from external wallets (MetaMask, Farcaster)

2. **Character Wallets (HD Index 1+)**
   - Created when user creates a character
   - Funded by main account wallet
   - Used for all in-game transactions (trading, buying items)
   - Visible to other players as character's wallet address
   - One wallet per character (initially one character per user)

**Automatic Creation:**
- Ethereum and Solana embedded wallets (main account) created automatically on first login
- Works for all users, even those connecting external wallets
- Seamless onboarding with zero user intervention
- Character wallets created on-demand via `createWallet({createAdditional: true})`

**External Wallet Support:**
- Users can also connect MetaMask, Coinbase, or other external wallets
- Farcaster wallet integration for social login
- External wallets can fund main account wallet
- External wallets coexist with embedded wallets

**Benefits of Hierarchical Architecture:**
- **Separation of concerns**: Funding (main) vs gameplay (character)
- **Security**: Main account can be secured separately from in-game wallet
- **Simplicity**: Clear distinction between account and character assets
- **Scalability**: Easy to add multiple characters with separate wallets
- **Flexibility**: Users can use external wallets to fund main account

**EIP-1193 Provider Integration:**
Privy wallets expose standard Ethereum provider interface:
```typescript
const wallet = wallets.find(w => w.address === desiredAddress);
const provider = await wallet.getEthereumProvider();

// Use with viem
import {createWalletClient, custom} from 'viem';
const client = createWalletClient({
  transport: custom(provider)
});

// Use with ethers
import {BrowserProvider} from 'ethers';
const ethersProvider = new BrowserProvider(provider);
```

**Solana Support:**
Solana wallets use different derivation path but same HD principles:
```typescript
import {useCreateWallet} from '@privy-io/react-auth/solana';
const {createWallet} = useCreateWallet();
await createWallet();
```

**Security Model:**
- Seed entropy protected by Privy cryptosystem
- Private keys never exposed to client (except during export)
- Signatures requested via secure Privy UI
- User authentication required for sensitive operations
- Optional biometric authentication on mobile

**Cost Considerations:**
- Privy charges per Monthly Active Wallet (MAW)
- Wallet = embedded wallet that performed action in month
- Inactive wallets don't count toward billing
- Volume discounts available at scale
- Need to monitor as user base grows

**Privacy Considerations:**
- HD wallets are deterministic (predictable addresses)
- If address 0 is known, address 1, 2, 3... can be computed
- Users should be educated about HD wallet privacy
- Advanced users can use separate seed (self-custody) for privacy

**Export and Self-Custody:**
Users can export at any time:
```typescript
const {exportWallet} = usePrivy();
await exportWallet({address: '0x...'});
```

Exports seed phrase (BIP-39 mnemonic) which can be imported into:
- MetaMask
- Rainbow Wallet
- Hardware wallets (Ledger, Trezor)
- Any BIP-44 compatible wallet

**This provides exit strategy** and addresses custody concerns.

**Mobile Implementation:**
React Native uses separate SDK (`@privy-io/expo`):
```typescript
import {useEmbeddedEthereumWallet} from '@privy-io/expo';
const {create, wallets} = useEmbeddedEthereumWallet();
```

Same functionality, different hook names for RN compatibility.

**Testing Strategy:**
- Test wallet creation flow (Playwright)
- Test multi-wallet management
- Test transaction signing
- Test export functionality
- Test cross-platform (web → mobile)
- Test recovery (lost device)

**Comparison to Existing ADRs:**
- **ADR-0001 (Bun)**: Performance optimization
- **ADR-0005 (ElizaOS)**: AI agent framework
- **ADR-0008 (Privy Wallets)**: User identity and asset ownership layer

Privy wallets complete the stack: fast runtime (Bun) + AI agents (ElizaOS) + user identity/assets (Privy).

**Future Enhancements:**
- Account Abstraction (when ERC-4337 matures)
- Gasless transactions (via paymaster)
- Social recovery (multi-device backup)
- Hardware wallet support (Ledger integration)
- Wallet migration tools
- Multi-sig wallets for guilds
- Additional chain support (Base, Arbitrum expansion)
- Wallet analytics dashboard
- Enhanced Farcaster integration features
