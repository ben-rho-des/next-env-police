import chalk from 'chalk';
import fs from 'fs';
import { DotenvParseOutput, parse } from 'dotenv';
import { resolve } from 'path';

interface policeOptions {
  envs?: string[];
  dir?: string;
  ignoreVars?: string[];
  ignoreVarsByPrefix?: string[];
  verbose?: boolean;
}

const encoding = 'utf8';
const configFilename = '.next-env-police.json';

const loadEnv = async (env = '.env') => {
  try {
    return parse(fs.readFileSync(env, { encoding }));
  } catch (e) {
    console.log(chalk.red(`🚓 No ${env}, remove this env from your ${configFilename} config`));
    return false;
  }
};

const getFiles = async (dir) => {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(dir, dirent.name);

      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
};

const checkFile = async (file, env, cfg, key) => {
  await fs.readFile(file, (err, data) => {
    if (err) {
      if (cfg.verbose) console.log(chalk.blue(`🚓 error reading file ${file} | ${err}`));
      throw err;
    }

    if (data.includes(env[key])) {
      console.log(chalk.red(`🚓 🚨 this file ${file} includes value of this key '${key}' 🚨 🚓`));
    }
  });
};

const grabConfig = async () => {
  const cfg: policeOptions = {
    envs: ['.env'],
    ignoreVarsByPrefix: ['NEXT_PUBLIC'],
    dir: '.next/static',
    verbose: false
  };

  try {
    const rawloadedCfg = await fs.promises.readFile(resolve(configFilename), { encoding });
    const loadedCfg = JSON.parse(rawloadedCfg);
    if (loadedCfg.verbose)
      console.log(`🚓 ${configFilename} : ${chalk.red(JSON.stringify(loadedCfg))}`);

    return {
      ...cfg,
      ...loadedCfg
    };
  } catch (e) {
    return cfg;
  }
};

const filterFiles = (files: string[]) => files.filter((f: string) => f.endsWith('.js'));
const filterSafeKeys = (keys: string[], cfg: policeOptions) =>
  keys.filter((k) => !cfg.ignoreVarsByPrefix.some((prefix) => k.startsWith(prefix)));

const searchBuiltByEnv = async (env, cfg) => {
  if (!env) {
    return;
  }
  const keys = Object.keys(env);
  const unsafeKeys = filterSafeKeys(keys, cfg);

  const allFiles = await getFiles(cfg.dir);
  const unsafeFiles = filterFiles(allFiles);

  if (cfg.verbose)
    console.log(
      chalk.red(`🚓 unsafeKeys: ${unsafeKeys}`),
      chalk.blue(`unsafeFiles: ${unsafeFiles}`)
    );

  await Promise.all(
    unsafeKeys.map(async (key): Promise<void> => {
      unsafeFiles.map(async (fileName): Promise<void> => {
        if (cfg.verbose) console.log(chalk.blue(`🚓 checking file: ${fileName} with key ${key} `));
        await checkFile(fileName, env, cfg, key);
      });
    })
  );
};

const start = async () => {
  const cfg = await grabConfig();

  const { envs } = cfg;

  await Promise.all(
    envs.map(async (envFile): Promise<void> => {
      const env: DotenvParseOutput | false = await loadEnv(envFile);
      if (cfg.verbose) console.log(`🚓 env ${env}: ${chalk.blue(JSON.stringify(env))}`);
      await searchBuiltByEnv(env, cfg);
    })
  );
};

// get 'em boys
start();

process.on('unhandledRejection', (err) => {
  throw err;
});
