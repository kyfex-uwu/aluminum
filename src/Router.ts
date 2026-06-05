import {type ArrowTemplate, html} from "@arrow-js/core";
import {htmlAcceptor, ref} from "./utils.js";
import createGenerator from "./ArrowElementGenerator.js";

const getRouteSymbol = Symbol("getRoute");
const routerSymbol = Symbol("router");
type TemplateOrPromise = ArrowTemplate|Promise<ArrowTemplate>
type stateType = {
    [variableName:string]:string,
    path:string,
    readonly originalPath:string
};
type Route = (variables:{[variableName:string]:string}, state:stateType)=>TemplateOrPromise;
type routeType = {[subPath:string]:routeType, [getRouteOrRouter:symbol]:Route|Router};

const default404 = html`404`;

/**
 * A basic router
 */
export default class Router{
    protected readonly routes:routeType={};
    protected readonly route404:Route;
    protected readonly transformBeforeFetch;

    /**
     * Creates a router
     * @param route404 The template to render if no other path was found. Defaults to "404" text
     * @param transformBeforeFetch An optional function that can transform the path before it's fetched (either in {@link getPath} or {@link getPathNo404}
     */
    constructor(route404:Route=()=>default404,
                transformBeforeFetch?:(template:TemplateOrPromise,
                vars:{[variableName:string]:string}, state:stateType)=>TemplateOrPromise) {
        this.route404 = route404;
        this.transformBeforeFetch = transformBeforeFetch || (template => template);
    }

    /**
     * Adds a route to this router
     *
     * The `path` can include variables; to do this, prefix some section with ":". When calling {@link getPath} or
     * {@link getPathNo404}, the `variables` object will include the variable.
     *
     * EX: if the route `path/to/:variableName/render` is defined, fetching the location `path/to/someValue/render` will
     * result in\
     * `{ ... variables: { ... variableName: "someValue" } }`
     *
     * @param path The location to render at. Should be of the form `path/to/render`, with no slash at the beginning
     * or end (unless you know what you're doing)
     * @param renderTemplate The template to render at this location
     */
    addRoute(path:string, renderTemplate:Route|Router){
        const subPaths = path.split("/");

        let position = this.routes;
        for(let i=0;i<subPaths.length;i++){
            const nextPos = subPaths[i]!;

            if(position[nextPos] !== undefined && position[nextPos][routerSymbol] instanceof Router && i !== subPaths.length-1)
                throw new Error(`Cannot create route "${path}", there is a router in the way`);
            if(position[nextPos] !== undefined && i !== subPaths.length-1 && !(renderTemplate instanceof Router)) position = position[nextPos];
            else{
                if(i === subPaths.length-1 && renderTemplate instanceof Router) {
                    position[nextPos]||={};
                    position[nextPos][routerSymbol] = renderTemplate;
                }
                else position=position[nextPos]={};
            }
        }

        if(!(renderTemplate instanceof Router)) position[getRouteSymbol] = renderTemplate;

        return this;
    }

    /**
     * Gets the template to render from the given location. Will default to the 404 path if no path found
     * @param location The location to fetch
     */
    getPath(location:string) {
        const data = this.getPathBase(location);
        return data.path ?? this.transformBeforeFetch(this.route404(data.vars, data.state), data.vars, data.state);
    }
    /**
     * Gets the template to render from the given location. Will return undefined if no path found
     * @param location The location to fetch
     */
    getPathNo404(location:string){
        return this.getPathBase(location).path;
    }
    private getPathBase(location:string){
        const vars = {};
        const state:stateType = {
            get originalPath(){ return location; },
            path:location
        };
        const pathOptions = this.getPathInternal(this.routes, location.split("/"), vars, state);

        if(pathOptions === undefined || pathOptions.length === 0 || pathOptions[0] === undefined)
            return {state, vars};
        return {
            state, vars,
            path: this.transformBeforeFetch(pathOptions[0]!, vars, state)
        }
    }

    /**
     * @return this router's 404 route
     */
    get404(){ return this.route404; }
    /**
     * @return `this.routes`. If you want just a single route, try {@link getPath}
     */
    accessRoutes(){ return this.routes; }

    private getPathInternal(routes:routeType, subPaths:string[],
                            variables:{[k:string]:string}, state:stateType):TemplateOrPromise[]|undefined {
        if (subPaths.length === 0 && routes[getRouteSymbol] !== undefined)
            return [(routes[getRouteSymbol] as Route)(variables, state)];

        //regular path
        if (routes[subPaths[0]!] !== undefined) {
            if(routes[subPaths[0]!] !== undefined) {
                const next = routes[subPaths[0]!]!;
                if(next[routerSymbol] instanceof Router && subPaths.length>1){
                    return (next[routerSymbol].getPathInternal(next[routerSymbol].accessRoutes(), subPaths.slice(1), {...variables}, {...state}) ?? [])
                        .map(template => (next[routerSymbol] as Router).transformBeforeFetch(template, {...variables}, {...state}));
                }else return this.getPathInternal(next, subPaths.slice(1), {...variables}, {...state});
            }
        }

        //variable path
        const toReturn:TemplateOrPromise[] = [];
        for (const key in routes) {
            if (!key.startsWith(":") || routes[key] === undefined) continue;

            const maybeRoute = (routes[key][routerSymbol] instanceof Router && subPaths.length>1) ?
                (routes[key][routerSymbol].getPathInternal(routes[key][routerSymbol].accessRoutes(), subPaths.slice(1), {
                    ...variables,
                    [key.slice(1)]:subPaths[0]!
            }, {...state}) ?? []).map(template => (routes[key]![routerSymbol] as Router).transformBeforeFetch(template, {
                ...variables,
                    [key.slice(1)]:subPaths[0]!
                }, {...state}) ) :
                this.getPathInternal(routes[key], subPaths.slice(1), {
                    ...variables,
                    [key.slice(1)]:subPaths[0]!
                }, {...state});
            if(maybeRoute !== undefined) toReturn.push(...maybeRoute);
        }

        if(toReturn.length>0) return toReturn;
    }
}

const hrefResolver = document.createElement("a");
/**
 * A router that can manages the web page based on the page's url
 */
export class PageAttachedRouter extends Router{
    protected readonly rootElement;
    protected readonly location = ref<string[]>([]);

    /**
     * Creates a page attached router
     * @param attachTo The dom element to attach this router to. Defaults to `document.body`
     * @param route404 The template to render if no other path was found. Defaults to "404" text
     * @param transformBeforeFetch An optional function that can transform the path before it's {@link rerender}ed
     */
    constructor(attachTo:HTMLElement|undefined, route404?:Route,
                transformBeforeFetch?:(template:TemplateOrPromise, vars:{[variableName:string]:string}, state:stateType)=>TemplateOrPromise) {
        super(route404, transformBeforeFetch);
        this.rootElement = attachTo;

        this.location.$on(()=> this.rerender());
        window.addEventListener("popstate", e => {
            this.redirect(window.location.pathname);
            e.preventDefault();
        });//back button handling
    }

    /**
     * Rerenders the page
     * @return this for chaining
     */
    public async rerender(){
        const path = this.getPath(this.location.value.join("/"));
        if(this.rootElement !== undefined) {
            this.rootElement.replaceChildren();
            if(path instanceof Promise)
                (await path)(this.rootElement);
            else
                path(this.rootElement);
        }
        return this;
    }

    /**
     * Updates the window's `location` and rerenders the page
     * @param newLocation The new url
     * @param replace Whether this new url should replace the current url in history or be a new entry
     * @return this for chaining
     */
    redirect(newLocation:string=window.location.pathname+window.location.search+window.location.hash, replace?:boolean){
        hrefResolver.href=newLocation;
        const url = URL.parse(hrefResolver.href)!;

        if(url.host !== window.location.host) {
            window.location.href = url.href+url.search+url.hash;
            return this;
        }
        this.location.value = url.pathname.split("/").slice(1);

        window.history[replace ? "replaceState" : "pushState"](null, "", "/" + this.location.value.join("/")+url.search+url.hash);
        return this;
    }

    /**
     * Creates a premade template for links that work with this router
     *
     * How to use:
     * ```ts
     * router.routerLink("example.com")`Link Label` // -> html`<a href="example.com">Link Label</a>`
     * ```
     * @param href the location to link to
     */
    public link(href:string){
        return htmlAcceptor(insides=>html`<a href="${href}" @click="${(e:Event)=>{
            e.preventDefault();
            this.redirect(href);
        }}">${insides}</a>`);
    }
}
