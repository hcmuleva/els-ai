export type MediaType = 'image' | 'audio' | 'video';
export type UploadMediaInput = {
    organizationId: string;
    dataUrl: string;
    fileName: string;
    mimeType?: string;
    mediaType: MediaType;
};
export type UploadMediaResult = {
    url: string;
    signedUrl: string;
    canonicalUrl: string;
    key: string;
    fileName: string;
    mediaType: MediaType;
    mimeType: string;
    assetId?: string;
};
type ClientOptions = {
    baseUrl?: string;
    internalSecret?: string;
    userId?: string;
};
export declare function uploadMediaToS3(input: UploadMediaInput, options?: ClientOptions): Promise<UploadMediaResult>;
export declare function getSignedMediaUrlIfNeeded(url: string, options?: ClientOptions): Promise<string>;
export declare function resolveSignedMediaUrls(urls: string[], options?: ClientOptions): Promise<Array<{
    sourceUrl: string;
    canonicalUrl: string;
    url: string;
}>>;
export declare function toPersistentMediaUrl(url: string): string;
export declare function canonicalizeMediaUrl(url: string, options?: ClientOptions): Promise<string>;
export {};
