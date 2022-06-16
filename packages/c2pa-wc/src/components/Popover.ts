import {
  arrow,
  autoUpdate,
  computePosition,
  ComputePositionConfig,
  flip,
  offset,
  Placement,
  shift,
  Strategy,
  autoPlacement,
} from '@floating-ui/dom';
import { animate } from '@lit-labs/motion';
import { css, html, LitElement, PropertyValueMap } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../../assets/svg/monochrome/help.svg';
import { PartPrefixable } from '../mixins/PartPrefixable';
import { defaultStyles } from '../styles';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'cai-popover': any;
    }
  }
}

@customElement('cai-popover')
export class Popover extends PartPrefixable(LitElement) {
  private _updateCleanupFn: Function | null = null;

  private _eventCleanupFns: Function[] = [];

  private positionConfig: Partial<ComputePositionConfig> = {};

  static readonly cssParts: Record<string, string> = {
    arrow: 'popover-arrow',
    box: 'popover-box',
    content: 'popover-content',
  };

  @state()
  protected _isShown = false;

  @property({ type: Number })
  animationDuration = 200;

  @property({ type: String })
  placement: Placement = 'left-end';

  @property({ type: String })
  strategy: Strategy = 'absolute';

  @property({ type: Boolean })
  arrow = false;

  @property({ type: Object })
  flip = {};

  @property({ type: Boolean })
  autoPlacement = false;

  @property({ type: Object })
  offset = { mainAxis: 10 };

  @property({ type: Object })
  shift = {};

  @property({ type: Boolean })
  interactive = false;

  @property({ type: String })
  trigger: string = 'mouseenter:mouseleave focus:blur';

  @query('#arrow')
  arrowElement: HTMLElement | undefined;

  @query('#content')
  contentElement: HTMLElement | undefined;

  @query('#trigger')
  triggerElement: HTMLElement | undefined;

  // @TODO: respect updated properties
  protected updated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>,
  ): void {
    const middleware: ComputePositionConfig['middleware'] = [];

    if (this.flip) {
      middleware.push(flip());
    }
    if (this.offset) {
      middleware.push(offset(this.offset));
    }
    if (this.shift) {
      middleware.push(shift(this.shift));
    }
    if (this.arrow) {
      middleware.push(
        arrow({
          element: this.arrowElement!,
        }),
      );
    }
    if (this.autoPlacement) {
      middleware.push(autoPlacement({ padding: 5 }));
    }

    this.positionConfig = {
      placement: this.placement,
      strategy: this.strategy,
      middleware,
    };
  }

  static get styles() {
    return [
      defaultStyles,
      css`
        :host {
          position: relative;
          z-index: 100;
        }

        #content {
          opacity: 0;
          position: absolute;
          top: 0;
          left: 0;
          background-color: var(--cai-popover-bg-color, #fff);
          color: var(--cai-popover-color, #222222);
          transition-property: transform, visibility, opacity;
          border-radius: 6px;
          border: 1px solid var(--cai-popover-border-color, #ddd);
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
        }
        #content.shown {
          opacity: 1;
        }
        #content.hidden {
          display: none;
        }
        #arrow {
          position: absolute;
          background: var(--cai-popover-bg-color, #fff);
          width: 16px;
          height: 16px;
          transform: rotate(45deg);
        }
        #trigger {
          cursor: pointer;
        }
      `,
    ];
  }

  private _showTooltip() {
    this._isShown = true;
    this._updatePosition();
  }

  private _hideTooltip() {
    this._isShown = false;
  }

  private _cleanupTriggers() {
    while (this._eventCleanupFns.length) {
      const cleanup = this._eventCleanupFns.shift();
      cleanup?.();
    }
  }

  private _setTriggers() {
    this._cleanupTriggers();
    const triggers = this.trigger.split(/\s+/);

    this._eventCleanupFns = triggers.map((trigger) => {
      const [show, hide] = trigger.split(':');
      this.triggerElement!.addEventListener(show, this._showTooltip.bind(this));
      if (this.interactive && hide === 'mouseleave') {
        this.contentElement!.addEventListener(
          hide,
          this._hideTooltip.bind(this),
        );
      } else {
        this.triggerElement!.addEventListener(
          hide,
          this._hideTooltip.bind(this),
        );
      }
      return () => {
        this.triggerElement!.removeEventListener(show, this._showTooltip);
        if (this.interactive && hide === 'mouseleave') {
          this.contentElement!.addEventListener(
            hide,
            this._hideTooltip.bind(this),
          );
        } else {
          this.triggerElement!.removeEventListener(hide, this._hideTooltip);
        }
      };
    });
  }

  private async _updatePosition() {
    const { x, y, middlewareData } = await computePosition(
      this.triggerElement!,
      this.contentElement!,
      this.positionConfig,
    );

    Object.assign(this.contentElement!.style, {
      left: `${x}px`,
      top: `${y}px`,
    });

    if (this.arrow && this.arrowElement) {
      const { x: ax, y: ay } = middlewareData.arrow!;
      Object.assign(this.arrowElement!.style, {
        left: ax != null ? `${ax}px` : '',
        top: ay != null ? `${ay}px` : '',
      });
    }
  }

  firstUpdated(): void {
    this._setTriggers();
    this._updateCleanupFn = autoUpdate(
      this.triggerElement!,
      this.contentElement!,
      () => {
        this._updatePosition();
      },
    );
    if (!this.interactive) {
      this.contentElement!.style.pointerEvents = 'none';
    }
  }

  disconnectedCallback(): void {
    this._updateCleanupFn?.();
    this._cleanupTriggers();
    super.disconnectedCallback();
  }

  render() {
    return html`<div id="element">
      <div
        id="content"
        class=${this._isShown ? 'shown' : ''}
        part=${Popover.cssParts.content}
        ${animate({
          keyframeOptions: {
            duration: this.animationDuration,
          },
          onStart: (anim) => {
            if (anim.element.classList.contains('shown')) {
              anim.element.classList.remove('hidden');
            }
          },
          onComplete: (anim) => {
            if (!anim.element.classList.contains('shown')) {
              anim.element.classList.add('hidden');
            }
          },
        })}
      >
        <slot name="content"></slot>
        ${this.arrow
          ? html`<div id="arrow" part=${Popover.cssParts.arrow}></div>`
          : null}
      </div>
      <div id="trigger" part=${Popover.cssParts.trigger}>
        <slot name="trigger"></slot>
      </div>
    </div>`;
  }
}
