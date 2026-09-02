module.exports = {
  ci: {
    collect: {
      startServerCommand: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3210",
      startServerReadyPattern: "Ready",
      url: [
        "http://127.0.0.1:3210/",
        "http://127.0.0.1:3210/auth",
        "http://127.0.0.1:3210/dashboard?guest=1",
      ],
      numberOfRuns: 1,
      settings: { chromeFlags: "--headless --no-sandbox --disable-gpu" },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.5 }],
        "categories:accessibility": ["warn", { minScore: 0.8 }],
        "categories:best-practices": ["warn", { minScore: 0.8 }],
        "categories:seo": ["warn", { minScore: 0.8 }],
        "csp-xss": "off",
      },
    },
    upload: { target: "filesystem", outputDir: "test-results/lighthouse" },
  },
};
