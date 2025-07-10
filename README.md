# hyperliquid-client

This is a client for the Hyperliquid network.

## Running a node

### Machine Spec

Recommended minimum hardware: 4 CPU cores, 32 GB RAM, 200 GB disk.

Currently only Ubuntu 24.04 is supported.

Ports 4001 and 4002 are used for gossip and must be open to the public. Otherwise, the node IP address will be deprioritized by peers in the p2p network.

For lowest latency, run the node in Tokyo, Japan.

### Set up

Refer to the [Hyperliquid Running non validator guide](https://github.com/hyperliquid-dex/node?tab=readme-ov-file#running-non-validator) for detailed instructions.

### Commands for running a node

The following command is supposed to run a non-validator node for Mainnet and make the server accessible only on the local machine (localhost) on port 8081. Since i haven't setup the ubuntu vm/container, i'm not sure if this command will work.

```bash
# This command does everything:
# 1. Runs a non-validator node for Mainnet.
# 2. Starts the Info Server (REST and WebSocket).
# 3. Makes the server accessible only on the local machine (localhost) on port 8081.
# 4. Runs the entire process in the background.

./hl-node --chain Mainnet run-node --info-server-host="127.0.0.1" --info-server-port=8081 &
```

