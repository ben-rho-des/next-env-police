import chalk from 'chalk';
import fs from 'fs';
import { DotenvParseOutput, parse } from 'dotenv';
import { resolve } from 'path';
import _yargs from 'yargs';

interface yargOptions {
  o?: string;
  options?: string;
  [x: string]: unknown;
  _: (string | number)[];
  $0: string;
}
interface policeOptions {
  envs?: string[];
  dir?: string;
  ignoreVars?: string[];
  ignoreVarsByPrefix?: string[];
  verbose?: boolean;
  throws?: boolean;
}

const argv = _yargs(process.argv.slice(2))
  .alias('o', 'options')
  .describe('o', 'overide default location for options file')
  .help('help').argv as yargOptions;

const encoding = 'utf8';
const configFilename = argv && argv.options ? argv.options : '.next-env-police.json';

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

const checkFile = async (file, env, cfg, key, envFile): Promise<string> => {
  await fs.readFile(file, (err, data): string => {
    if (err) {
      if (cfg.verbose) console.log(chalk.blue(`🚓 error reading file ${file} | ${err}`));
      throw err;
    }

    if (data.includes(env[key])) {
      if (cfg.throws) {
        return `env: ${envFile} has key '${key}' and found value in ${file}`;
      } else {
        console.log(chalk.red(`🚓 env: ${envFile} has key '${key}' and found value in ${file}`));
      }
    }
    return '';
  });
  return '';
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

const searchBuiltByEnv = async (env, cfg, envFile) => {
  const keys = Object.keys(env);
  const unsafeKeys = filterSafeKeys(keys, cfg);

  const allFiles = await getFiles(cfg.dir);
  const unsafeFiles = filterFiles(allFiles);

  if (cfg.verbose)
    console.log(
      chalk.red(`🚓 unsafeKeys: ${unsafeKeys}`),
      chalk.blue(`unsafeFiles: ${unsafeFiles}`)
    );

  return await Promise.all(
    unsafeKeys.map(async (key): Promise<Promise<string>[]> => {
      return await unsafeFiles.map(async (fileName): Promise<string> => {
        if (cfg.verbose) console.log(chalk.blue(`🚓 checking file: ${fileName} with key ${key} `));
        return await checkFile(fileName, env, cfg, key, envFile);
      });
    })
  );
};

const start = async () => {
  const cfg = await grabConfig();

  const { envs } = cfg;

  const bads = await Promise.all(
    envs.map(async (envFile): Promise<any> => {
      const env: DotenvParseOutput | false = await loadEnv(envFile);
      if (cfg.verbose)
        console.log(`🚓 env ${JSON.stringify(env)}: ${chalk.blue(JSON.stringify(env))}`);
      return await searchBuiltByEnv(env, cfg, envFile);
    })
  );
  if (cfg.throw) {
    const err = new Error('🚓 found private env vars in your built app');
    err.message = JSON.stringify(bads);
    console.log(chalk.red(`🚓 found private env vars in your built app | ${JSON.stringify(bads)}`));
    throw err;
  }
};

// get 'em boys
start();

process.on('unhandledRejection', (err) => {
  throw err;
});
