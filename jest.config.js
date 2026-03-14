/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/source/test'],
    moduleFileExtensions: ['ts', 'js'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            diagnostics: false,
            tsconfig: {
                target: 'ES2017',
                module: 'CommonJS',
                moduleResolution: 'node',
                esModuleInterop: true,
                skipLibCheck: true,
                strict: true,
                experimentalDecorators: true,
                resolveJsonModule: true,
                types: ['jest', 'node'],
            }
        }]
    },
    testMatch: ['**/*.test.ts'],
    setupFiles: ['<rootDir>/source/test/mocks/editor-mock.ts'],
};
