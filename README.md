# Web Monetization Notes
> Gist-like site that allows users to get paid via Web Monetization

- [Overview](#overview)
- [How to Run](#how-to-run)
  - [Prerequisites](#prerequisites)
  - [Install and Run](#install-and-run)
- [TODOs and Features](#todos-and-features)

![screenshot](./screenshot.png)

## Overview

Example use of [Koa Web Monetization](https://github.com/sharafian/koa-web-monetization)

## How to Run

### Prerequisites

- You should be running [Moneyd](https://github.com/interledgerjs/moneyd-xrp)
  for Interledger payments. [Local
  mode](https://github.com/interledgerjs/moneyd-xrp#local-test-network) will work
  fine.

- Build and install the [Minute](https://github.com/sharafian/minute)
  extension. This adds Web Monetization support to your browser.

### Install and Run

```sh
git clone https://github.com/sharafian/web-monetization-notes.git
cd web-monetization-notes
npm install
DEBUG=koa* node index.js
```

## TODOs and Features

- [ ] Deploy live instance
- [ ] Show how much money each post has made (or how many views)
- [ ] Search?
