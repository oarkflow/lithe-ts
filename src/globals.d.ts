export {};

declare global {
  interface Navigator {
    connection?: { saveData?: boolean; effectiveType?: string; downlink?: number; rtt?: number };
    deviceMemory?: number;
    getBattery?: () => Promise<{ charging:boolean; level:number; addEventListener?(name:string,listener:()=>void):void }>;
  }

  var __LITHE_REACTIVE_CAUSE__: unknown;
  var __LITHE_CORRELATION_ID__: string | null | undefined;
  var __LITHE_CORRELATION_EVENT__: ((type:string, attributes?:Record<string,unknown>, id?:string|null)=>void) | undefined;
  var __LITHE_REACTIVE_DEBUG_HOOK__: {
    registerDependency?(dependency:unknown):void;
    registerObserver?(observer:unknown):void;
    unregisterObserver?(observer:unknown):void;
    mutation?(event:unknown):void;
  } | undefined;
  var __LITHE_OWNER_HOOK__: Record<string,((...args:any[])=>unknown)> | undefined;
  var __LITHE_RESUME_SIGNAL_SNAPSHOT__: Record<string,unknown> | undefined;
  var __LITHE_HMR_SIGNAL_SNAPSHOT__: Record<string,unknown> | undefined;
  var __LITHE_NAMED_SIGNALS__: Map<string,unknown> | undefined;
  var __LITHE_RESUME_SIGNAL_WAITERS__: Map<string,Set<(signal:unknown)=>void>> | undefined;
  var __LITHE_HMR_SIGNAL_REGISTRY__: Map<string,unknown> | undefined;
  var __LITHE_HMR__: unknown;
}

declare global {
  var __LITHE_DEVTOOLS__: unknown;
  var __LITHE_RESTORED_OWNERS__: unknown[] | undefined;
  var __LITHE_RESUME_COMPUTATIONS__: Map<string, unknown> | undefined;
}
