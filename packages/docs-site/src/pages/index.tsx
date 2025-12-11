import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            API Documentation
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout description="Hyperscape - 3D multiplayer game engine">
      <HomepageHeader />
      <main>
        <div className="container" style={{ padding: "2rem 0" }}>
          <div className="row">
            <div className="col col--4">
              <h3>📦 Shared</h3>
              <p>Core engine: ECS, networking, physics, React components</p>
            </div>
            <div className="col col--4">
              <h3>🖥️ Client</h3>
              <p>Web client: 3D rendering, player controls, UI</p>
            </div>
            <div className="col col--4">
              <h3>⚙️ Server</h3>
              <p>Game server: world management, persistence, handlers</p>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
