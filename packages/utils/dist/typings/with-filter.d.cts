export type FilterFn<TSource = any, TArgs = any, TContext = any> = (rootValue?: TSource, args?: TArgs, context?: TContext, info?: any) => boolean | Promise<boolean>;
export type ResolverFn<TSource = any, TArgs = any, TContext = any> = (rootValue?: TSource, args?: TArgs, context?: TContext, info?: any) => AsyncIterator<any> | Promise<AsyncIterator<any>>;
export type WithFilter<TSource = any, TArgs = any, TContext = any> = (asyncIteratorFn: ResolverFn<TSource, TArgs, TContext>, filterFn: FilterFn<TSource, TArgs, TContext>) => ResolverFn<TSource, TArgs, TContext>;
export declare function withFilter<TSource = any, TArgs = any, TContext = any>(asyncIteratorFn: ResolverFn<TSource, TArgs, TContext>, filterFn: FilterFn<TSource, TArgs, TContext>): ResolverFn<TSource, TArgs, TContext>;
