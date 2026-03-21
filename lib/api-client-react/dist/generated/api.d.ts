import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { ErrorResponse, HealthStatus, ReframeRequest, ReframeResponse } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * Returns server health status
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Takes a raw thought string and returns word-level cognitive analysis with reframe suggestions
 * @summary Analyse and reframe a thought
 */
export declare const getReframeThoughtUrl: () => string;
export declare const reframeThought: (reframeRequest: ReframeRequest, options?: RequestInit) => Promise<ReframeResponse>;
export declare const getReframeThoughtMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reframeThought>>, TError, {
        data: BodyType<ReframeRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reframeThought>>, TError, {
    data: BodyType<ReframeRequest>;
}, TContext>;
export type ReframeThoughtMutationResult = NonNullable<Awaited<ReturnType<typeof reframeThought>>>;
export type ReframeThoughtMutationBody = BodyType<ReframeRequest>;
export type ReframeThoughtMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Analyse and reframe a thought
 */
export declare const useReframeThought: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reframeThought>>, TError, {
        data: BodyType<ReframeRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof reframeThought>>, TError, {
    data: BodyType<ReframeRequest>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map