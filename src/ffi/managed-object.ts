/**
 * Base class for objects backed by a C pointer from foundation-models-c.
 *
 * Handles reference counting (FMRetain / FMRelease) and provides
 * a FinalizationRegistry-based destructor so callers don't need to
 * manually release resources.
 *
 * Mirrors Python SDK's `_ManagedObject`.
 */

import type { Pointer } from "./types.js";
import { getNativeBindings, getNativeBindingsEpoch } from "./native.js";

interface FinalizerHandle {
  ptr: Pointer;
  epoch: number;
}

/**
 * FinalizationRegistry releases the C pointer when the JS wrapper is GC'd.
 *
 * Because FinalizationRegistry is not guaranteed to fire, callers can
 * also call `release()` explicitly for deterministic cleanup.
 *
 * Releases are skipped when the native-bindings epoch no longer matches
 * (e.g. unit tests swapped mock bindings for the real dylib).
 */
const pointerRegistry = new FinalizationRegistry<FinalizerHandle>((handle) => {
  try {
    if (handle.epoch !== getNativeBindingsEpoch()) return;
    const native = getNativeBindings();
    native.fmRelease(handle.ptr);
  } catch {
    // If native bindings aren't available during shutdown, ignore.
  }
});

export class ManagedObject {
  /** The underlying C pointer. Becomes 0 after release. */
  protected _ptr: Pointer;
  private _released = false;
  private _nativeEpoch: number;

  constructor(ptr: Pointer) {
    if (!ptr) throw new Error("ManagedObject: received null pointer");
    this._ptr = ptr;
    this._nativeEpoch = getNativeBindingsEpoch();
    pointerRegistry.register(this, { ptr, epoch: this._nativeEpoch }, this);
  }

  /** Raw pointer value. Throws if already released. */
  get ptr(): Pointer {
    if (this._released) {
      throw new Error("ManagedObject: pointer has been released");
    }
    return this._ptr;
  }

  /** Whether this object has been released. */
  get isReleased(): boolean {
    return this._released;
  }

  /** Explicitly release the underlying C pointer. Idempotent. */
  release(): void {
    if (this._released) return;
    this._released = true;
    pointerRegistry.unregister(this);
    try {
      // Only release against the same bindings generation that created us.
      if (this._nativeEpoch === getNativeBindingsEpoch()) {
        const native = getNativeBindings();
        native.fmRelease(this._ptr);
      }
    } catch {
      // Ignore if native not available
    }
    this._ptr = 0 as Pointer;
  }

  /** Retain the pointer (increment reference count). */
  retain(): void {
    const native = getNativeBindings();
    native.fmRetain(this.ptr);
  }
}
