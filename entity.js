let nextEntityId = 1;

export function createEntity(name = "entity") {
    return {
        id: nextEntityId++,
        name,
        components: new Map(),
        alive: true
    };
}

export function addComponent(entity, key, value) {
    entity.components.set(key, value);
    return entity;
}

export function getComponent(entity, key) {
    return entity.components.get(key);
}

export function hasComponent(entity, key) {
    return entity.components.has(key);
}
