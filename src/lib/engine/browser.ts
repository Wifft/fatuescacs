// One engine per tab, created lazily and reused.
import { bootEngine, type EngineBuild } from "./boot";
import { Engine, workerTransport } from "./engine";

export interface BrowserEngine {
  engine: Engine;
  build: EngineBuild;
  name: string;
  loadMs: number;
}

let instance: Promise<BrowserEngine> | null = null;

export function getBrowserEngine(): Promise<BrowserEngine> {
  if (!instance) {
    instance = (async () => {
      const booted = await bootEngine();
      const engine = new Engine(workerTransport(booted.worker));
      await engine.configure();
      return { engine, build: booted.build, name: booted.name, loadMs: booted.loadMs };
    })();
    // Allow a retry after a failed boot.
    instance.catch(() => {
      instance = null;
    });
  }
  return instance;
}
