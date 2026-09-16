import "./styles.css";
import "./results/chart-zoom-plugin";
import { createWorkflowApp } from "./ui/workflow-app";

const app = document.querySelector<HTMLElement>("#app");
if (app === null) throw new Error("Application root is unavailable.");

createWorkflowApp(app);
