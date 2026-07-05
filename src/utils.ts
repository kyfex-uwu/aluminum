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

/**
 * A simple computed value. You can access the value with `.value`
 * @param computer the function that is run to compute the value
 */
export class Computed<T>{
    protected readonly internal;
    constructor(computer:()=>T) {
        this.internal = ref(undefined as T);

        watch(computer, newVal => this.internal.value = newVal);
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
 * Returns a premade html template that runs a transform function when used.
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
 * @param transform a function that accepts an html template and transforms it
 */
export function htmlAcceptor<T>(transform:((html:ArrowTemplate)=>T)):PseudoTemplate<T>{
    return (strings:TemplateStringsArray, ...expSlots: any[])=>{
        return transform(html(strings, ...expSlots));
    }
}

/**
 * Another way to create an element with more flexibility
 *
 * EX:
 * ```ts
 * element("div", { class: "className className2", id: "elementId" })`contents`
 * // ^ produces this v
 * <div class="className className2" id="elementId">contents</div>
 * ```
 *
 * @param type The type of the element to return
 * @param attributes An object of the form { <attributeName>: <attributeValue> }
 */
export function element(type:string, attributes:{[k:string]:any}){
    const orderedContents = Object.entries(attributes);
    return htmlAcceptor(insides=>html(
        [`<${type} `+(orderedContents.length===0?"":orderedContents[0]![0]+'="'),
            ...orderedContents.slice(1).map(data=>`" ${data[0]}="`),
            (orderedContents.length>0?'"':"")+'>', `</${type}>`] as unknown as TemplateStringsArray,
        ...[...orderedContents.map(data => data[1]), insides]));
}
