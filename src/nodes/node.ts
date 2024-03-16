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
  nodesAreReady: () => boolean,
  setNodeIsReady: (index: number) => void

) {
  var answers = new Array(N).fill(null);
  var i = 0;
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
    answers[i] = req.body.value;
    console.log(`Node ${nodeId} received a message:`, answers[i]);
    i++;
    if (i === N) {
      answers = new Array(N).fill(null);
      i = 0;
    }
  });

  node.get("/start", async (req, res) => {
    res.status(200).send("started");
    while(!decided){
    if (!isFaulty && nodesAreReady()) {
      // TODO: implement the consensus algorithm

      // phase 1 : broadcast
      // we broadcast the value to all nodes
       for (let ind = 0; ind < N; ind++) {
        if (ind !== nodeId) {
          fetch(`http://localhost:${BASE_NODE_PORT + ind}/message`, {
            method: "POST",
            body: JSON.stringify({ value: state }),
            headers: { "Content-Type": "application/json" },
          });
        }
        console.log(`Node ${nodeId} broadcasted a message:`, state);
      }
        
       // phase 2: decide
       // check if any value has occurred more than F times
      const counts = new Map<Value, number>();
      answers.forEach((value) => {
        if (value !== null) {
          const count = counts.get(value) || 0;
          counts.set(value, count + 1);
        }
      });
      let decidedValue: Value | null = null;
      counts.forEach((count, value) => {
        if (count > F) {
          decidedValue = value;
        }
      });
      if (decidedValue !== null) {
        state = decidedValue;
        decided = true;
        console.log(`Node ${nodeId} decided on value:`, decidedValue);
      }
      // if no value has occurred more than F times, the node decides on its initial value
      else {
      //the new value is randomly chosen
        if (Math.random() > 0.5) {
          state = 1;
        }
        else {
          state = 0;
        }
      }
    }
    else
    {
      console.log(`Node ${nodeId} is not ready`);
      decided = true;
    }
  }
  }
  );

  node.get("/stop", async (req, res) => {
    // TODO: stop the consensus algorithm
    decided = true;
    console.log(`Node ${nodeId} stopped`);
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
