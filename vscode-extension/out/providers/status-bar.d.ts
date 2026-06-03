import { StateReader } from '../services/state-reader';
export declare class CopadoStatusBar {
    private readonly stateReader;
    private storyItem;
    private modeItem;
    constructor(stateReader: StateReader);
    update(): void;
    dispose(): void;
}
