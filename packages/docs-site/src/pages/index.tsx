import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            View API Documentation
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Hyperscape - AI-powered virtual world with RPG elements">
      <HomepageHeader />
      <main>
        <div className="container" style={{padding: '2rem 0'}}>
          <div className="row">
            <div className="col col--4">
              <h3>📦 Shared Package</h3>
              <p>Core shared utilities, entities, and systems used across client and server.</p>
            </div>
            <div className="col col--4">
              <h3>🖥️ Client Package</h3>
              <p>Frontend application code including React components and 3D rendering.</p>
            </div>
            <div className="col col--4">
              <h3>⚙️ Server Package</h3>
              <p>Backend server code for networking, database, and game logic.</p>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}

