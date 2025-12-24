import swc3 from 'rollup-plugin-swc3';
import { fileURLToPath } from 'url';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import copy from 'rollup-plugin-copy';
import { globSync } from 'glob';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';

const absolutePath = (relativePath) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const packageJson = JSON.parse(fs.readFileSync(absolutePath('../package.json')));

function getInputs(filePaths) {
  const inputs = {};

  filePaths.forEach((filePath) => {
    const filteredFiles = globSync(filePath).filter(
      (file) =>
        !['.spec.ts', '.config.ts', '.test.ts', '.d.ts'].some((pattern) =>
          file.endsWith(pattern)
        )
    );

    const entries = filteredFiles.map((file) => [
      file.slice(0, file.length - path.extname(file).length),
      absolutePath(file),
    ]);

    Object.assign(inputs, Object.fromEntries(entries));
  });

  return inputs;
}

function generatePackageJSON() {
  return {
    name: 'generate-package-json',
    generateBundle: async () => {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const productionDependencies = Object.fromEntries(
        Object.entries(allDeps).filter(
          ([_, version]) => version && !version.includes('workspace:')
        )
      );

      await writeFile(
        absolutePath('../dist/agent/package.json'),
        JSON.stringify(
          {
            name: '@exodus/agent',
            version: packageJson.version,
            main: 'src/main.js',
            dependencies: productionDependencies,
            packageManager: packageJson.packageManager,
            pnpm: packageJson.pnpm,
          },
          null,
          2,
        ),
      );
    },
  };
}

const externalDependencies = Object.entries(
  packageJson.dependencies || {}
).filter(([_, version]) => !version.includes('workspace:'));

export default {
  input: getInputs(['src/**/*.ts', 'packages/**/*.ts']),
  output: {
    dir: absolutePath('../dist/agent'),
    format: 'cjs',
    preserveModules: false,
  },
  treeshake: {
    moduleSideEffects: true,
  },
  external: [
    ...externalDependencies.map(([name]) => name),
    /node_modules/,
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
  ],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'production'
      ),
    }),
    nodeResolve({
      preferBuiltins: true,
      extensions: ['.ts', '.js', '.json'],
    }),
    swc3({
      tsconfig: absolutePath('tsconfig.json'),
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: false,
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2021',
        externalHelpers: true,
        keepClassNames: true,
      },
      module: {
        type: 'commonjs',
        strict: false,
        strictMode: true,
        lazy: false,
        noInterop: false,
      },
    }),
    commonjs({
      extensions: ['.js', '.ts'],
      transformMixedEsModules: true,
    }),
    json(),
    copy({
      targets: [
        {
          src: absolutePath('pnpm-lock.yaml'),
          dest: absolutePath('../dist/agent'),
        },
        {
          src: absolutePath('src/assets/**/*'),
          dest: absolutePath('../dist/agent/src/assets'),
        },
        {
          src: absolutePath('Dockerfile'),
          dest: absolutePath('../dist/agent'),
        },
      ],
      copySync: true,
    }),
    generatePackageJSON(),
  ],
};
