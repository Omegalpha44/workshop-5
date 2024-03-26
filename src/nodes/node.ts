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
  let stopped = false;

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
    res.status(200).send("received");
  });

  node.get("/start", async (req, res) => {
    res.status(200).send("started");
    while(!decided && !stopped && !isFaulty){
      if (!isFaulty && nodesAreReady()) {
        // phase 1 : broadcast
        // we broadcast the value to all nodes that are safe
        const faultyNodes = new Array(N).fill(null);
        const statusChecks2 = faultyNodes.map((value, index) => {
          return fetch(`http://localhost:${BASE_NODE_PORT+ index}/status`)
            .then(res => res.text())
            .then(status => {
              if (status === 'faulty') {
          faultyNodes[index] = true;
              }
            });
        });

        await Promise.all(statusChecks2);
        const broadcastPromises = [];
        for (let ind = 0; ind < N-1; ind++) {
          if (ind !== nodeId && !faultyNodes[ind]) {
            const promise = fetch(`http://localhost:${BASE_NODE_PORT + ind}/message`, {
              method: "POST",
              body: JSON.stringify({ value: state }),
              headers: { "Content-Type": "application/json" },
            })
            .then(res => {
              if (!res.ok) {
          throw new Error(`Failed to send message from node ${nodeId} to node ${ind}: ${res.statusText}`);
              }
              console.log(`Node ${nodeId} sent a message to node ${ind}:`, state);
              return res;
            })
            .catch(error => {
              console.error(`Error sending message from node ${nodeId} to node ${ind}:`, error);
            });
            if (promise) {
              broadcastPromises.push(promise);
            }
          }
        }

        // wait for all broadcast messages to be sent
        await Promise.all(broadcastPromises);
        // phase 2: decide
        const counts = new Map<Value, number>();


        answers.forEach((value, index) => {
          if (value !== null && value === state) {
            const count = counts.get(value) || 0;
            counts.set(value, count + 1);
          }
        });

        decided = counts.size > F;
        
          if (decided) {
            // if a value has occurred more than F times, the node decides on that value
            decided = true;
            console.log(`Node ${nodeId} decided on value:`, state);
          } else {
            // if no value has occurred more than F times, the node does not decide and waits for the next round
            console.log(`Node ${nodeId} did not decide, waiting for the next round.`);
          }
          // reset state for next round
          state = Math.random() < 0.5 ? 0 : 1; // 50% chance of being 0 or 1
          answers = new Array(N).fill(null);
          i = 0;
      }
    }
  }
  );
  // node.get("/start", async (req, res) => {
  // if(isFaulty){
  //   console.log(`Node ${nodeId} is faulty`);
  // }

  //   while(!decided && !stopped  && !isFaulty){
      
  //     // find the faulty nodes
  //     let faultyArray = new Array(N).fill(null);

  //     const statusChecks = faultyArray.map((value, index) => {
  //       return fetch(`http://localhost:${BASE_NODE_PORT+ index}/status`)
  //         .then(res => res.text())
  //         .then(status => {
  //           if (status === 'faulty') {
  //             faultyArray[index] = true;
  //           }
  //         });
  //     });

  //     await Promise.all(statusChecks);

  //     // send the message to the nodes
  //     const sendMessages = [];
  //     for (let ind = 0; ind < N; ind++) {
  //       if (ind !== nodeId && !faultyArray[ind]) {
  //         const promise = fetch(`http://localhost:${BASE_NODE_PORT + ind}/message`, {
  //           method: "POST",
  //           body: JSON.stringify({ value: state }),
  //           headers: { "Content-Type": "application/json" },
  //         })
  //         .then(res => {
  //           if (!res.ok) {
  //             throw new Error(`Failed to send message from node ${nodeId} to node ${ind}: ${res.statusText}`);
  //           }
  //           console.log(`Node ${nodeId} sent a message to node ${ind}:`, state);
  //           return res;
  //         })
  //         .catch(error => {
  //           console.error(`Error sending message from node ${nodeId} to node ${ind}:`, error);
  //         });
  //         if (promise) {
  //           sendMessages.push(promise);
  //         }
  //       }
  //     }
  //     // wait for all messages to be sent
  //     await Promise.all(sendMessages);

  //     // count the number of returns that are similar to its own value
  //     const counts = new Map<Value, number>();
  //     answers.forEach((value, index) => {
  //       if (value !== null && value === state) {
  //         const count = counts.get(value) || 0;
  //         counts.set(value, count + 1);
  //       }
  //     });

  //     // check if the value is decided
  //     let decidedValue: Value | null = null;
  //     counts.forEach((count, value) => {
  //       if (count > F) {
  //         decidedValue = value;
  //         decided = true; // the value is decided
  //         console.log(`Node ${nodeId} decided on value:`, decidedValue);
  //       }
  //     });
      
  //     // if the value is not decided, reset the state and answers
  //     if (decidedValue == null) {
  //       console.log(`Node ${nodeId} did not decide, waiting for the next round.`);
  //       state = Math.random() < 0.5 ? 0 : 1; // 50% chance of being 0 or 1
  //       answers = new Array(N).fill(null);
  //       i = 0;
  //     }
  //   }
  // });
  node.get("/stop", async (req, res) => {
    // TODO: stop the consensus algorithm
    stopped = true;
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
