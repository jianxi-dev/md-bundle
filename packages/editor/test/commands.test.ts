/**
 * Command registry tests — verifies CommandRegistry behavior.
 *
 * Tests registration, lookup, availability filtering, execution,
 * and key-binding resolution.
 */
import { describe, expect, it } from 'vitest';
import { CommandRegistry, type Command } from '../src/commands';

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 'test-cmd',
    label: 'Test Command',
    execute: () => {},
    ...overrides,
  };
}

describe('CommandRegistry', () => {
  it('registers and retrieves a command by id', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'foo', label: 'Foo' });
    registry.register(cmd);
    expect(registry.execute('foo', undefined as never)).toBeUndefined();
  });

  it('returns null for an unregistered command id', () => {
    const registry = new CommandRegistry();
    expect(registry.getKeyBinding('nonexistent')).toBeNull();
  });

  it('returns the key binding for a registered command', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'bold', keyBinding: 'Mod-b' });
    registry.register(cmd);
    expect(registry.getKeyBinding('bold')).toBe('Mod-b');
  });

  it('returns null for a command without a key binding', () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ id: 'plain' });
    registry.register(cmd);
    expect(registry.getKeyBinding('plain')).toBeNull();
  });

  it('overwrites a command with the same id (last-write-wins)', () => {
    const registry = new CommandRegistry();
    const cmd1 = makeCommand({ id: 'dup', label: 'First' });
    const cmd2 = makeCommand({ id: 'dup', label: 'Second' });
    registry.register(cmd1);
    registry.register(cmd2);
    expect(registry.all()).toHaveLength(1);
    expect(registry.all()[0].label).toBe('Second');
  });

  it('returns all registered commands via all()', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'a' }));
    registry.register(makeCommand({ id: 'b' }));
    registry.register(makeCommand({ id: 'c' }));
    expect(registry.all()).toHaveLength(3);
  });

  it('filters commands by availability', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'always' }));
    registry.register(
      makeCommand({
        id: 'conditional',
        available: () => false,
      }),
    );
    const available = registry.getAvailable(undefined as never);
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('always');
  });

  it('returns all commands when none have availability guards', () => {
    const registry = new CommandRegistry();
    registry.register(makeCommand({ id: 'x' }));
    registry.register(makeCommand({ id: 'y' }));
    expect(registry.getAvailable(undefined as never)).toHaveLength(2);
  });

  it('executes a command by id', () => {
    const registry = new CommandRegistry();
    let executed = false;
    registry.register(
      makeCommand({
        id: 'run-me',
        execute: () => {
          executed = true;
        },
      }),
    );
    registry.execute('run-me', undefined as never);
    expect(executed).toBe(true);
  });

  it('no-ops when executing an unregistered command', () => {
    const registry = new CommandRegistry();
    expect(() => registry.execute('missing', undefined as never)).not.toThrow();
  });
});
