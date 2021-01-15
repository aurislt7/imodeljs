/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterface, RpcManager } from "../../imodeljs-common";
import { IpcWebSocketMessage, IpcWebSocketMessageType, IpcWebSocketTransport } from "../../ipc/IpcWebSocket";
import { RpcMarshaling } from "../core/RpcMarshaling";
import { RpcRequestFulfillment, SerializedRpcRequest } from "../core/RpcProtocol";
import { MobileRpcProtocol } from "./MobileRpcProtocol";
import { MobileRpcRequest } from "./MobileRpcRequest";

const IPC = "__ipc__";

class IpcInterface extends RpcInterface {
  public static interfaceName = IPC;
  public static interfaceVersion = "0.0.0";
  public async send() { }
}

/** @internal */
export class MobileIpcTransport extends IpcWebSocketTransport {
  private _protocol: MobileRpcProtocol;
  private _listeners: Array<(message: IpcWebSocketMessage) => void> = [];
  private _client: IpcInterface;

  public constructor(protocol: MobileRpcProtocol) {
    super();
    this._protocol = protocol;

    RpcManager.initializeInterface(IpcInterface);
    this._client = RpcManager.getClientForInterface(IpcInterface);
  }

  public send(message: IpcWebSocketMessage): void {
    if (message.type === IpcWebSocketMessageType.Send || message.type === IpcWebSocketMessageType.Invoke) {
      this.sendToBackend(message); // eslint-disable-line @typescript-eslint/no-floating-promises
    } else if (message.type === IpcWebSocketMessageType.Push || message.type === IpcWebSocketMessageType.Response) {
      this.sendToFrontend(message); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  public listen(handler: (message: IpcWebSocketMessage) => void): void {
    this._listeners.push(handler);
  }

  public consumeRequest(request: SerializedRpcRequest): boolean {
    if (request.operation.interfaceDefinition !== IPC)
      return false;

    const message = RpcMarshaling.deserialize(this._protocol, request.parameters)[0] as IpcWebSocketMessage;
    this.broadcast(message);
    return true;
  }

  public consumeResponse(response: RpcRequestFulfillment): boolean {
    if (response.interfaceName !== IPC)
      return false;

    const message = RpcMarshaling.deserialize(this._protocol, response.result) as IpcWebSocketMessage;
    this.broadcast(message);
    return true;
  }

  private async sendToBackend(message: IpcWebSocketMessage) {
    const request = new MobileRpcRequest(this._client, "send", [message]);
    const encoded = await MobileRpcProtocol.encodeRequest(request);
    this._protocol.sendToBackend(encoded);
    request.dispose();
  }

  private async sendToFrontend(message: IpcWebSocketMessage) {
    const result = await RpcMarshaling.serialize(this._protocol, message);
    const fulfillment: RpcRequestFulfillment = { result, rawResult: message, interfaceName: IPC, id: message.channel, status: 0 };
    const encoded = MobileRpcProtocol.encodeResponse(fulfillment);
    this._protocol.sendToFrontend(encoded);
  }

  private broadcast(message: IpcWebSocketMessage) {
    for (const listener of this._listeners)
      listener(message);
  }
}