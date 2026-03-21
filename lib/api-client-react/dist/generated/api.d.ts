import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { ConversationMessagesResponse, ConversationsListResponse, DiscussRequest, DiscussResponse, ErrorResponse, HealthStatus, PatternsRequest, PatternsResponse, ReflectRequest, ReflectResponse, ReframeRequest, ReframeResponse } from "./api.schemas";
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
/**
 * Sends a conversation history and returns Claude's next Socratic question
 * @summary Socratic coaching dialogue
 */
export declare const getDiscussUrl: () => string;
export declare const discuss: (discussRequest: DiscussRequest, options?: RequestInit) => Promise<DiscussResponse>;
export declare const getDiscussMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof discuss>>, TError, {
        data: BodyType<DiscussRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof discuss>>, TError, {
    data: BodyType<DiscussRequest>;
}, TContext>;
export type DiscussMutationResult = NonNullable<Awaited<ReturnType<typeof discuss>>>;
export type DiscussMutationBody = BodyType<DiscussRequest>;
export type DiscussMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Socratic coaching dialogue
 */
export declare const useDiscuss: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof discuss>>, TError, {
        data: BodyType<DiscussRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof discuss>>, TError, {
    data: BodyType<DiscussRequest>;
}, TContext>;
/**
 * Accepts the original thought, word analysis, and chosen reframes, then returns a narrative insight paragraph synthesising the session
 * @summary Generate an LLM insight for a completed reframing session
 */
export declare const getReflectOnSessionUrl: () => string;
export declare const reflectOnSession: (reflectRequest: ReflectRequest, options?: RequestInit) => Promise<ReflectResponse>;
export declare const getReflectOnSessionMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reflectOnSession>>, TError, {
        data: BodyType<ReflectRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reflectOnSession>>, TError, {
    data: BodyType<ReflectRequest>;
}, TContext>;
export type ReflectOnSessionMutationResult = NonNullable<Awaited<ReturnType<typeof reflectOnSession>>>;
export type ReflectOnSessionMutationBody = BodyType<ReflectRequest>;
export type ReflectOnSessionMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Generate an LLM insight for a completed reframing session
 */
export declare const useReflectOnSession: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reflectOnSession>>, TError, {
        data: BodyType<ReflectRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof reflectOnSession>>, TError, {
    data: BodyType<ReflectRequest>;
}, TContext>;
/**
 * Returns a list of all past conversations ordered by most recent
 * @summary List conversations
 */
export declare const getConversationsUrl: () => string;
export declare const getConversations: (options?: RequestInit) => Promise<ConversationsListResponse>;
export declare const getConversationsQueryKey: () => readonly ["/api/conversations"];
export declare const getConversationsQueryOptions: <TData = Awaited<ReturnType<typeof getConversations>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConversations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getConversations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetConversationsQueryResult = NonNullable<Awaited<ReturnType<typeof getConversations>>>;
export type GetConversationsQueryError = ErrorType<ErrorResponse>;
export declare function useGetConversations<TData = Awaited<ReturnType<typeof getConversations>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConversations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Returns the full message history for a conversation
 * @summary Get messages for a conversation
 */
export declare const getConversationMessagesUrl: (id: number) => string;
export declare const getConversationMessages: (id: number, options?: RequestInit) => Promise<ConversationMessagesResponse>;
export declare const getConversationMessagesQueryKey: (id: number) => readonly [`/api/conversations/${number}/messages`];
export declare const getConversationMessagesQueryOptions: <TData = Awaited<ReturnType<typeof getConversationMessages>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConversationMessages>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getConversationMessages>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetConversationMessagesQueryResult = NonNullable<Awaited<ReturnType<typeof getConversationMessages>>>;
export type GetConversationMessagesQueryError = ErrorType<ErrorResponse>;
export declare function useGetConversationMessages<TData = Awaited<ReturnType<typeof getConversationMessages>>, TError = ErrorType<ErrorResponse>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConversationMessages>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * Accepts a category distribution summary and thought samples, then returns
 * 2-3 natural-language pattern observations
 * @summary Generate AI pattern observations from history
 */
export declare const getPatternsUrl: () => string;
export declare const getPatterns: (patternsRequest: PatternsRequest, options?: RequestInit) => Promise<PatternsResponse>;
export declare const getGetPatternsMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getPatterns>>, TError, {
        data: BodyType<PatternsRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof getPatterns>>, TError, {
    data: BodyType<PatternsRequest>;
}, TContext>;
export type GetPatternsMutationResult = NonNullable<Awaited<ReturnType<typeof getPatterns>>>;
export type GetPatternsMutationBody = BodyType<PatternsRequest>;
export type GetPatternsMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Generate AI pattern observations from history
 */
export declare const useGetPatterns: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof getPatterns>>, TError, {
        data: BodyType<PatternsRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof getPatterns>>, TError, {
    data: BodyType<PatternsRequest>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map