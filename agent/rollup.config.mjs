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
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const packageJson = JSON.parse(
  fs.readFileSync(absolutePath('agent/package.json')).toString()
);

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
    generateBundle: async (_, bundles) => {
      const dependencies = Object.entries(packageJson.dependencies || {});

      const externalDependencies = {
        '@swc/helpers': packageJson.dependencies?.['@swc/helpers'] || '^0.5.15',
      };

      const matcher1 = new RegExp(/(require).*/g);
      const matcher2 = new RegExp(/(?!require\(")[^"][^"]+(?="\))/g);

      const importDependency = Object.values(bundles).flatMap(
        ({ code }) => code.match(matcher1) || []
      );

      const imports =
        importDependency
          .join('')
          .match(matcher2)
          ?.filter(
            (value) =>
              !value.startsWith('.') && !value.startsWith('@swc/helpers')
          )
          .join(',') || '';

      const importDependencies = dependencies
        .map(([name, version]) => {
          if (imports.match(new RegExp(name))) {
            return [name, version];
          }
        })
        .filter((value) => value !== undefined);

      Object.assign(
        externalDependencies,
        Object.fromEntries(importDependencies)
      );

      await writeFile(
        absolutePath('dist/agent/package.json'),
        JSON.stringify(
          {
            name: '@genesis/agent',
            version: packageJson.version,
            main: 'agent/src/main.js',
            dependencies: externalDependencies,
          },
          null,
          2
        )
      );
    },
  };
}

export default {
  input: getInputs(['agent/src/**/*.ts', 'packages/**/*.ts']),
  output: {
    dir: './dist/agent',
    format: 'cjs',
    preserveModules: false,
  },
  treeshake: {
    moduleSideEffects: true,
  },
  external: [
    /node_modules/,
    'mongoose',
    'ioredis',
    'bcrypt',
    'yamljs',
    'rate-limiter-flexible',
    'bottleneck',
    '@nestjs/swagger',
    'mock-aws-s3',
    'aws-sdk',
    'nock',
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
    '@nestjs/microservices',
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
      tsconfig: absolutePath('tsconfig.base.json'),
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
          dest: './dist/agent',
        },
        {
          src: absolutePath('agent/src/assets/**/*'),
          dest: './dist/agent/agent/src/assets',
        },
      ],
      copySync: true,
    }),
    generatePackageJSON(),
  ],
};
