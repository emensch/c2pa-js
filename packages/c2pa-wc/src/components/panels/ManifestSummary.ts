import { LitElement, html, css, nothing } from 'lit';
import { hasChanged, defaultDateFormatter } from '../../utils';
import merge from 'lodash/merge';
import { customElement, property, state } from 'lit/decorators.js';
import {
  MinimumViableProvenanceConfig,
  SectionTemplate,
  MinimumViableProvenance,
  ProducedBy,
  ProducedWith,
  EditsAndActivity,
  SocialMedia,
  AssetsUsed,
} from './ManifestSections';
import defaultStringMap from './ManifestSummary.str.json';
import { defaultStyles } from '../../styles';
import type { SerializableManifestData } from 'c2pa';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'cai-manifest-summary': any;
    }
  }
}

type SectionMapping = Record<string, SectionTemplate>;

export type ManifestSummaryConfig = MinimumViableProvenanceConfig & {
  sections: (defaults: SectionMapping) => SectionMapping;
};

@customElement('cai-manifest-summary')
export class ManifestSummary extends LitElement {
  static readonly cssParts = {
    container: 'manifest-summary-container',
    content: 'manifest-summary-content',
    sections: 'manifest-summary-sections',
    section: 'manifest-summary-section',
    signer: 'manifest-summary-signer',
    date: 'manifest-summary-date',
    thumbnail: 'manifest-summary-thumbnail',
    viewMore: 'manifest-summary-view-more',
  };

  static readonly defaultSections: SectionMapping = {
    producedWith: ProducedWith,
    // @TODO: can this ts-ignore be avoided?
    // @ts-ignore
    editsAndActivity: EditsAndActivity,
    assetsUsed: AssetsUsed,
    producedBy: ProducedBy,
    socialMedia: SocialMedia,
  };

  static readonly defaultConfig: ManifestSummaryConfig = {
    stringMap: defaultStringMap,
    dateFormatter: defaultDateFormatter,
    sections: (defaults) => defaults,
  };

  static get styles() {
    return [
      defaultStyles,
      css`
        #container {
          width: 280px;
          padding: 20px;
        }
        #sections {
          padding-top: 20px;
          margin-top: 20px;
          border-top: 1px solid #e1e1e1;
        }
        #sections > .section {
          padding-bottom: 20px;
          margin-bottom: 20px;
          border-bottom: 1px solid #e1e1e1;
        }
        #view-more {
          transition: background-color 150ms ease-in-out;
          background-color: transparent;
          border-radius: 9999px;
          border: 2px solid #b3b3b3;
          color: var(--cai-color);
          display: block;
          font-weight: bold;
          margin-top: 20px;
          padding: 8px 0;
          text-align: center;
          text-decoration: none;
          width: 100%;
        }
        #view-more:hover {
          background-color: #eeeeee;
        }
      `,
    ];
  }

  @property({
    type: Object,
    hasChanged,
  })
  manifest: SerializableManifestData | undefined;

  @property({
    type: String,
    attribute: 'view-more-url',
  })
  viewMoreUrl = '';

  @property({
    attribute: false,
    hasChanged,
  })
  config: Partial<ManifestSummaryConfig> = {};

  @state()
  protected _config: ManifestSummaryConfig = ManifestSummary.defaultConfig;

  willUpdate(changed: Map<string, any>) {
    if (changed.has('config')) {
      this._config = merge({}, ManifestSummary.defaultConfig, this.config);
    }
  }

  render() {
    if (!this.manifest) {
      return null;
    }

    const sectionProps = {
      manifest: this.manifest,
      config: this._config,
      html,
    };

    return html`<div id="container" part=${ManifestSummary.cssParts.container}>
      <div slot="header">
        ${MinimumViableProvenance(
          merge(sectionProps, {
            config: {
              partMap: ManifestSummary.cssParts,
            },
          }),
        )}
      </div>
      <div id="sections" part=${ManifestSummary.cssParts.sections}>
        ${Object.values(
          this._config.sections(ManifestSummary.defaultSections),
        ).map(
          (sectionFn) =>
            html`<div class="section" part=${ManifestSummary.cssParts.section}>
              ${sectionFn(sectionProps)}
            </div>`,
        )}
      </div>
      ${this.viewMoreUrl
        ? html`
            <a
              id="view-more"
              href=${this.viewMoreUrl}
              target="_blank"
              part=${ManifestSummary.cssParts.viewMore}
            >
              ${this._config.stringMap['manifest-summary.viewMore']}
            </a>
          `
        : nothing}
    </div>`;
  }
}
