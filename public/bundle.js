
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.ui = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function styleInject(css, ref) {
      if ( ref === void 0 ) ref = {};
      var insertAt = ref.insertAt;

      if (!css || typeof document === 'undefined') { return; }

      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.type = 'text/css';

      if (insertAt === 'top') {
        if (head.firstChild) {
          head.insertBefore(style, head.firstChild);
        } else {
          head.appendChild(style);
        }
      } else {
        head.appendChild(style);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
    }

    var css_248z$1 = ":root {\n  background-color: whitesmoke;\n  font-size: 10px; }\n\nbody {\n  max-width: 600px;\n  padding: 4rem;\n  font-size: 1.6em;\n  margin: 0 auto; }\n";
    styleInject(css_248z$1);

    var css_248z = "img{display:block;max-width:100%;height:auto}body{background:black;padding:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'}details.svelte-16wfacb{color:white;padding:1rem}summary.svelte-16wfacb{position:sticky;top:0;padding:0.5rem;background:black;font-weight:700;text-transform:uppercase;cursor:pointer}.grid.svelte-16wfacb{display:grid;grid-template-columns:repeat(6, 1fr);grid-auto-rows:auto}";
    styleInject(css_248z);

    /* src/Main.svelte generated by Svelte v3.38.3 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[24] = list[i];
    	return child_ctx;
    }

    // (143:4) {#each displayedChampions as champion}
    function create_each_block_1(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[11](/*champion*/ ctx[24], ...args);
    	}

    	return {
    		c() {
    			img = element("img");
    			if (img.src !== (img_src_value = squareImg(/*champion*/ ctx[24].id))) attr(img, "src", img_src_value);
    			attr(img, "width", "120");
    			attr(img, "height", "120");
    			attr(img, "loading", "lazy");
    			attr(img, "draggable", "true");
    		},
    		m(target, anchor) {
    			insert(target, img, anchor);

    			if (!mounted) {
    				dispose = listen(img, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*displayedChampions*/ 16 && img.src !== (img_src_value = squareImg(/*champion*/ ctx[24].id))) {
    				attr(img, "src", img_src_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(img);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (160:4) {#each displayItems as item}
    function create_each_block(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			img = element("img");
    			if (img.src !== (img_src_value = itemImg(/*item*/ ctx[21].iconPath))) attr(img, "src", img_src_value);
    			attr(img, "width", "120");
    			attr(img, "height", "120");
    			attr(img, "loading", "lazy");
    			attr(img, "draggable", "true");
    		},
    		m(target, anchor) {
    			insert(target, img, anchor);

    			if (!mounted) {
    				dispose = listen(img, "dragend", /*handleDrop*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*displayItems*/ 32 && img.src !== (img_src_value = itemImg(/*item*/ ctx[21].iconPath))) {
    				attr(img, "src", img_src_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(img);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let details0;
    	let summary0;
    	let t1;
    	let input0;
    	let t2;
    	let div0;
    	let t3;
    	let details1;
    	let summary1;
    	let t5;
    	let input1;
    	let t6;
    	let div1;
    	let t7;
    	let dialog_1;
    	let t8;
    	let t9;
    	let div2;
    	let p0;
    	let t11;
    	let img0;
    	let img0_src_value;
    	let t12;
    	let div3;
    	let p1;
    	let t14;
    	let img1;
    	let img1_src_value;
    	let t15;
    	let div4;
    	let p2;
    	let t17;
    	let img2;
    	let img2_src_value;
    	let t18;
    	let div5;
    	let p3;
    	let t20;
    	let img3;
    	let img3_src_value;
    	let t21;
    	let form;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*displayedChampions*/ ctx[4];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*displayItems*/ ctx[5];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			details0 = element("details");
    			summary0 = element("summary");
    			summary0.textContent = "Champions";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t3 = space();
    			details1 = element("details");
    			summary1 = element("summary");
    			summary1.textContent = "Items";
    			t5 = space();
    			input1 = element("input");
    			t6 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			dialog_1 = element("dialog");
    			t8 = text(/*selectedChampion*/ ctx[3]);
    			t9 = space();
    			div2 = element("div");
    			p0 = element("p");
    			p0.textContent = "Square portrait";
    			t11 = space();
    			img0 = element("img");
    			t12 = space();
    			div3 = element("div");
    			p1 = element("p");
    			p1.textContent = "Splash (default)";
    			t14 = space();
    			img1 = element("img");
    			t15 = space();
    			div4 = element("div");
    			p2 = element("p");
    			p2.textContent = "Splash (centered)";
    			t17 = space();
    			img2 = element("img");
    			t18 = space();
    			div5 = element("div");
    			p3 = element("p");
    			p3.textContent = "Splash (tile)";
    			t20 = space();
    			img3 = element("img");
    			t21 = space();
    			form = element("form");
    			form.innerHTML = `<button type="submit">Close</button>`;
    			attr(summary0, "class", "svelte-16wfacb");
    			attr(input0, "type", "text");
    			attr(input0, "placeholder", "Search champions");
    			attr(div0, "class", "grid svelte-16wfacb");
    			attr(details0, "class", "svelte-16wfacb");
    			attr(summary1, "class", "svelte-16wfacb");
    			attr(input1, "type", "text");
    			attr(input1, "placeholder", "Search items");
    			attr(div1, "class", "grid svelte-16wfacb");
    			attr(details1, "class", "svelte-16wfacb");
    			if (img0.src !== (img0_src_value = squareImg(/*selectedChampion*/ ctx[3]))) attr(img0, "src", img0_src_value);
    			attr(img0, "width", "80");
    			attr(img0, "height", "80");
    			attr(img0, "draggable", "true");
    			if (img1.src !== (img1_src_value = splash(/*selectedChampion*/ ctx[3]))) attr(img1, "src", img1_src_value);
    			attr(img1, "width", "176");
    			attr(img1, "height", "99");
    			attr(img1, "draggable", "true");
    			if (img2.src !== (img2_src_value = splashCentered(/*selectedChampion*/ ctx[3]))) attr(img2, "src", img2_src_value);
    			attr(img2, "width", "176");
    			attr(img2, "height", "99");
    			attr(img2, "draggable", "true");
    			if (img3.src !== (img3_src_value = tile(/*selectedChampion*/ ctx[3]))) attr(img3, "src", img3_src_value);
    			attr(img3, "width", "200");
    			attr(img3, "height", "200");
    			attr(img3, "draggable", "true");
    			attr(form, "method", "dialog");
    		},
    		m(target, anchor) {
    			insert(target, details0, anchor);
    			append(details0, summary0);
    			append(details0, t1);
    			append(details0, input0);
    			set_input_value(input0, /*championSearch*/ ctx[0]);
    			append(details0, t2);
    			append(details0, div0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div0, null);
    			}

    			insert(target, t3, anchor);
    			insert(target, details1, anchor);
    			append(details1, summary1);
    			append(details1, t5);
    			append(details1, input1);
    			set_input_value(input1, /*itemSearch*/ ctx[1]);
    			append(details1, t6);
    			append(details1, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			insert(target, t7, anchor);
    			insert(target, dialog_1, anchor);
    			append(dialog_1, t8);
    			append(dialog_1, t9);
    			append(dialog_1, div2);
    			append(div2, p0);
    			append(div2, t11);
    			append(div2, img0);
    			append(dialog_1, t12);
    			append(dialog_1, div3);
    			append(div3, p1);
    			append(div3, t14);
    			append(div3, img1);
    			append(dialog_1, t15);
    			append(dialog_1, div4);
    			append(div4, p2);
    			append(div4, t17);
    			append(div4, img2);
    			append(dialog_1, t18);
    			append(dialog_1, div5);
    			append(div5, p3);
    			append(div5, t20);
    			append(div5, img3);
    			append(dialog_1, t21);
    			append(dialog_1, form);
    			/*dialog_1_binding*/ ctx[13](dialog_1);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[10]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[12]),
    					listen(img0, "dragend", /*handleDrop*/ ctx[7]),
    					listen(img1, "dragend", /*handleDrop*/ ctx[7]),
    					listen(img2, "dragend", /*handleDrop*/ ctx[7]),
    					listen(img3, "dragend", /*handleDrop*/ ctx[7])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*championSearch*/ 1 && input0.value !== /*championSearch*/ ctx[0]) {
    				set_input_value(input0, /*championSearch*/ ctx[0]);
    			}

    			if (dirty & /*squareImg, displayedChampions, handleClick*/ 80) {
    				each_value_1 = /*displayedChampions*/ ctx[4];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*itemSearch*/ 2 && input1.value !== /*itemSearch*/ ctx[1]) {
    				set_input_value(input1, /*itemSearch*/ ctx[1]);
    			}

    			if (dirty & /*itemImg, displayItems, handleDrop*/ 160) {
    				each_value = /*displayItems*/ ctx[5];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*selectedChampion*/ 8) set_data(t8, /*selectedChampion*/ ctx[3]);

    			if (dirty & /*selectedChampion*/ 8 && img0.src !== (img0_src_value = squareImg(/*selectedChampion*/ ctx[3]))) {
    				attr(img0, "src", img0_src_value);
    			}

    			if (dirty & /*selectedChampion*/ 8 && img1.src !== (img1_src_value = splash(/*selectedChampion*/ ctx[3]))) {
    				attr(img1, "src", img1_src_value);
    			}

    			if (dirty & /*selectedChampion*/ 8 && img2.src !== (img2_src_value = splashCentered(/*selectedChampion*/ ctx[3]))) {
    				attr(img2, "src", img2_src_value);
    			}

    			if (dirty & /*selectedChampion*/ 8 && img3.src !== (img3_src_value = tile(/*selectedChampion*/ ctx[3]))) {
    				attr(img3, "src", img3_src_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(details0);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(details1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t7);
    			if (detaching) detach(dialog_1);
    			/*dialog_1_binding*/ ctx[13](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function squareImg(id) {
    	return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;
    }

    function splash(id) {
    	return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/uncentered/${id}/${id}000.jpg`;
    }

    function splashCentered(id) {
    	return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${id}/${id}000.jpg`;
    }

    function tile(id) {
    	return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${id}/${id}000.jpg`;
    }

    function itemImg(itemPath) {
    	const path = itemPath.replace("/lol-game-data/assets/ASSETS/Items/Icons2D/", "/rcp-be-lol-game-data/global/default/assets/items/icons2d/");
    	console.log("xxxxx path", path);
    	return `https://raw.communitydragon.org/pbe/plugins${path}`.toLowerCase();
    }

    function instance($$self, $$props, $$invalidate) {
    	let displayedChampions;
    	let displayItems;

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let championsList = [];
    	let itemsList = [];
    	let canvas;
    	let ctx;
    	let championSearch = "";
    	let itemSearch = "";
    	let dialog;
    	let selectedChampion;

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		canvas = document.createElement("canvas");
    		ctx = canvas.getContext("2d");

    		yield Promise.all([
    			fetch("https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json").then(res => res.json()),
    			fetch("https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/items.json").then(res => res.json())
    		]).then(([champions, items]) => {
    			$$invalidate(8, championsList = champions);
    			$$invalidate(9, itemsList = items);
    		}).catch(() => {
    			
    		});
    	}));

    	function handleClick(id) {
    		dialog.showModal();
    		$$invalidate(3, selectedChampion = id);
    	}

    	function decode(url, canvas, ctx) {
    		return __awaiter(this, void 0, void 0, function* () {
    			const image = yield new Promise((resolve, reject) => {
    					const img = new Image();
    					img.onload = () => resolve(img);
    					img.onerror = () => reject();
    					img.crossOrigin = "Anonymous";
    					img.src = url;
    				});

    			canvas.width = image.width;
    			canvas.height = image.height;
    			ctx.drawImage(image, 0, 0);
    			const imageData = ctx.getImageData(0, 0, image.width, image.height);
    			return imageData;
    		});
    	}

    	function encode(canvas, ctx, imageData) {
    		return __awaiter(this, void 0, void 0, function* () {
    			ctx.putImageData(imageData, 0, 0);

    			return yield new Promise((resolve, reject) => {
    					canvas.toBlob(blob => {
    						const reader = new FileReader();
    						reader.onload = () => resolve(new Uint8Array(reader.result));
    						reader.onerror = () => reject(new Error("Could not read from blob"));
    						reader.readAsArrayBuffer(blob);
    					});
    				});
    		});
    	}

    	const handleDrop = e => __awaiter(void 0, void 0, void 0, function* () {
    		// Don't proceed if the item was dropped inside the plugin window.
    		if (e.view.length === 0) return;

    		const src = e.target.src;
    		if (!src) return;
    		const imgData = yield decode(e.target.src, canvas, ctx);
    		const newData = yield encode(canvas, ctx, imgData);

    		window.parent.postMessage(
    			{
    				pluginDrop: {
    					clientX: e.clientX,
    					clientY: e.clientY,
    					items: [],
    					dropMetadata: {
    						data: newData,
    						width: imgData.width,
    						height: imgData.height
    					}
    				}
    			},
    			"*"
    		);
    	});

    	function input0_input_handler() {
    		championSearch = this.value;
    		$$invalidate(0, championSearch);
    	}

    	const click_handler = (champion, e) => handleClick(champion.id);

    	function input1_input_handler() {
    		itemSearch = this.value;
    		$$invalidate(1, itemSearch);
    	}

    	function dialog_1_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			dialog = $$value;
    			$$invalidate(2, dialog);
    		});
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*championsList, championSearch*/ 257) {
    			$$invalidate(4, displayedChampions = championsList.filter(champion => champion.id > 0 && champion.name.toLowerCase().includes(championSearch.toLowerCase())).sort((a, b) => {
    				return a.name.localeCompare(b.name);
    			}));
    		}

    		if ($$self.$$.dirty & /*itemsList, itemSearch*/ 514) {
    			$$invalidate(5, displayItems = itemsList.filter(item => item.id > 0 && item.name.toLowerCase().includes(itemSearch.toLowerCase())));
    		}
    	};

    	return [
    		championSearch,
    		itemSearch,
    		dialog,
    		selectedChampion,
    		displayedChampions,
    		displayItems,
    		handleClick,
    		handleDrop,
    		championsList,
    		itemsList,
    		input0_input_handler,
    		click_handler,
    		input1_input_handler,
    		dialog_1_binding
    	];
    }

    class Main extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new Main({
      target: document.body,
    });

    return app;

})));
