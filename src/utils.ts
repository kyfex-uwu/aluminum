import {type ArrowTemplate, html, reactive, watch} from "@arrow-js/core";

/**
 * Creates a simple watchable value. You can access the value with `.value`\
 * Shortcut for `new Ref(...)`
 * @param defaultValue the default value
 */
export function ref<T>(defaultValue:T){
    return new Ref(defaultValue);
}
/**
 * Creates a simple computed value. You can access the value with `.value`\
 * Shortcut for `new Computed(...)`
 * @param expression the expression behind the computed's value
 */
export function computed<T>(expression:()=>T){
    return new Computed(expression);
}

/**
 * A simple watchable value. You can access the value with `.value`
 * @param defaultValue the default value
 */
export class Ref<T>{
    protected readonly internalReactive;
    constructor(defaultValue:T) {
        this.internalReactive = reactive({value:defaultValue});
    }
    get value():T{ return this.internalReactive.value as T; }
    set value(value:T){ this.internalReactive.value = value as any; }

    /**
     * Adds an observer
     * @param callback - The observer to call when the value changes
     */
    $on(callback: (value: T, oldValue: T) => void){
        this.internalReactive.$on("value", callback);
    }
    /**
     * Removes an observer
     * @param callback - The observer to stop calling
     */
    $off(callback: (value: T, oldValue: T) => void){
        this.internalReactive.$off("value", callback);
    }
}

//--

export class Computed<T>{
    protected readonly internal;
    constructor(defaultValue:()=>T) {
        this.internal = ref(undefined as T);

        watch(defaultValue, newVal => this.internal.value = newVal);
    }
    get value():T{ return this.internal.value; }

    /**
     * Adds an observer
     * @param callback - The observer to call when this value changes
     */
    $on(callback: (value: T, oldValue: T) => void){
        this.internal.$on(callback);
    }
    /**
     * Removes an observer
     * @param callback - The observer to stop calling
     */
    $off(callback: (value: T, oldValue: T) => void){
        this.internal.$off(callback);
    }
}

type PseudoTemplate<T> = (strings:TemplateStringsArray, ...expSlots: any[]) => T
/**
 * Returns a premade html template that triggers a callback when used.
 *
 * EX:
 * ```ts
 * function linkCreator(href:string){
 *   return htmlAcceptor( (linkText:any) =>
 *     html`<a href=${href}>${linkText}</a>`);
 * }
 *
 * linkCreator("example.com")`Example link`
 * // ^ produces this v
 * html`<a href="example.com">Example link</a>`
 * ```
 * @param callback a function that accepts an html template and transforms it
 */
export function htmlAcceptor<T>(callback:((html:ArrowTemplate)=>T)):PseudoTemplate<T>{
    return (strings:TemplateStringsArray, ...expSlots: any[])=>{
        return callback(html(strings, ...expSlots));
    }
}
