/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus, CloudStorageContainerDescriptor, CloudStorageContainerUrl, CloudStorageProvider, IModelError, ServerError } from "@bentley/imodeljs-common";
import * as as from "azure-storage";
import { PassThrough, Readable, pipeline } from "stream";
import * as zlib from "zlib";

/** @beta */
export interface CloudStorageServiceCredentials {
  service: "azure" | "external";
  account: string;
  accessKey: string;
}

/** @beta */
export interface CloudStorageUploadOptions {
  type?: string;
  cacheControl?: string;
  contentEncoding?: "gzip";
}

/** @beta */
export abstract class CloudStorageService {
  public initialize(): void { }
  public terminate(): void { }
  public abstract id: CloudStorageProvider;
  public abstract obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date, clientIp?: string): CloudStorageContainerUrl;
  public abstract upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions): Promise<string>;
  public async download(_name: string): Promise<Readable | undefined> { return Promise.resolve(undefined); }

  protected makeDescriptor(id: CloudStorageContainerDescriptor) {
    return { name: id.name, provider: this.id };
  }
}

/** @beta */
export class AzureBlobStorage extends CloudStorageService {
  private _service: as.BlobService;

  public constructor(credentials: CloudStorageServiceCredentials) {
    super();

    if (credentials.service !== "azure" || !credentials.account || !credentials.accessKey) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid credentials for Azure blob storage.");
    }

    this._service = as.createBlobService(credentials.account, credentials.accessKey);
  }

  public readonly id = CloudStorageProvider.Azure;

  public obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date, clientIp?: string): CloudStorageContainerUrl {
    const policy: as.common.SharedAccessPolicy = {
      AccessPolicy: {
        Permissions: as.BlobUtilities.SharedAccessPermissions.READ + as.BlobUtilities.SharedAccessPermissions.LIST,
        Expiry: expiry,
      },
    };

    if (clientIp && clientIp !== "localhost" && clientIp !== "127.0.0.1" && clientIp !== "::1") {
      policy.AccessPolicy.IPAddressOrRange = clientIp;
    }

    const token = this._service.generateSharedAccessSignature(id.name, "", policy);

    const url: CloudStorageContainerUrl = {
      descriptor: this.makeDescriptor(id),
      valid: 0,
      expires: expiry.getTime(),
      url: this._service.getUrl(id.name, undefined, token),
    };

    return url;
  }

  public async ensureContainer(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._service.createContainerIfNotExists(name, (error, _result, response) => {
        if (error || !response.isSuccessful) {
          reject(new ServerError(this._computeStatusCode(response), this._computeErrorMessage("Unable to create tile container.", error)));
        } else {
          // _result indicates whether container already existed...irrelevant to semantics of our API
          resolve();
        }
      });
    });
  }

  public async upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let source: PassThrough;

      try {
        source = new PassThrough();
        source.end(data);
      } catch (err) {
        return reject(new IModelError(BentleyStatus.ERROR, `Unable to create upload stream for "${name}".`));
      }

      const createOptions: as.BlobService.CreateBlockBlobRequestOptions = {
        contentSettings: {
          contentType: (options && options.type) ? options.type : "application/octet-stream",
          cacheControl: (options && options.cacheControl) ? options.cacheControl : "private, max-age=31536000, immutable",
        },
      };

      try {
        await this.ensureContainer(container);

        if (options && options.contentEncoding === "gzip") {
          createOptions.contentSettings!.contentEncoding = options.contentEncoding;
          let pipelineError: NodeJS.ErrnoException;

          const uploader = this._service.createWriteStreamToBlockBlob(container, name, createOptions, (error, result, response) => {
            if (pipelineError) {
              return reject(pipelineError);
            }

            if (error || !response.isSuccessful) {
              reject(new ServerError(this._computeStatusCode(response), this._computeErrorMessage(`Unable to upload "${name}" (compressed).`, error)));
            } else {
              resolve(result.etag);
            }
          });

          const compressor = zlib.createGzip();

          pipeline(source, compressor, uploader, (err) => {
            pipelineError = err;
            reject(err);
          });
        } else {
          this._service.createBlockBlobFromStream(container, name, source, data.byteLength, createOptions, (error, result, response) => {
            if (error || !response.isSuccessful) {
              reject(new ServerError(this._computeStatusCode(response), this._computeErrorMessage(`Unable to upload "${name}".`, error)));
            } else {
              resolve(result.etag);
            }
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private _computeStatusCode(response?: as.ServiceResponse): number {
    if (typeof (response) === "undefined") {
      return BentleyStatus.ERROR;
    }

    return response.statusCode;
  }

  private _computeErrorMessage(prefix: string, error?: any): string {
    let message = prefix;

    if (typeof (error) !== "undefined") {
      if (error instanceof Error) {
        message += ` (${error.toString()})`;
      } else {
        message += ` (${JSON.stringify(error)})`;
      }
    }

    return message;
  }
}
