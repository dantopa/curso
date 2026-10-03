import { InputSystem } from '../systems/input';
import { TouchControls } from '../systems/touchControls';

/** Process-wide singletons shared by scenes. */
export const input = new InputSystem();
export const touch = new TouchControls(input.virtual);
