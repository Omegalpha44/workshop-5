import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState } from "../types";

export async function node(
  nodeId: number,
  N: number,
  F: number,
  initialValue: Value,
  isFaulty: boolean,
  answers: Value[],
  nodesAreReady: () => boolean,
  setNodeIsReady: (index: number) => void
  
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  let state: Value = initialValue;
  let decided = false;

  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });

  node.post("/message", (req, res) => {
    answers.push(req.body.value); // we stock the value in the array
  });

  node.get("/start", async (req, res) => {
    if (!isFaulty && nodesAreReady()) {
      // TODO: implement the consensus algorithm

      // phase 1 : broadcast
      // we broadcast the initial value to all nodes
       for (let index = 0; index < N; index++) {
        if (index !== nodeId) {
          fetch(`http://localhost:${BASE_NODE_PORT + index}/message`, {
            method: "POST",
            body: JSON.stringify({ value: initialValue }),
            headers: { "Content-Type": "application/json" },
          });
        }}
      // phase 2 : decide
      // we decide the value
      state = initialValue;

      



      res.status(200).send("started");
    } else {
      res.status(500).send("not ready");
    }
  });

  node.get("/stop", async (req, res) => {
    // TODO: stop the consensus algorithm

    res.status(200).send("stopped");
  });

  node.get("/getState", (req, res) => {
    const nodeState: NodeState = {
      killed: false,
      x: state,
      decided,
      k: null
    };

    if (isFaulty) {
      nodeState.x = null;
      nodeState.decided = null;
      nodeState.k = null;
    }

    res.status(200).json(nodeState);
  });

  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(`Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`);

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}

