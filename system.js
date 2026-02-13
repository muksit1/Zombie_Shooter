export class System {
    constructor(priority = 100) {
        this.priority = priority;
    }

    update(_dt, _ctx, _entities) {
        // Implement in subclasses.
    }
}
