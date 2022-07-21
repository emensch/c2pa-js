/**
 * Copyright 2022 Adobe
 * All Rights Reserved.
 *
 * NOTICE: Adobe permits you to use, modify, and distribute this file in
 * accordance with the terms of the Adobe license agreement accompanying
 * it.
 */

import flow from 'lodash/fp/flow';
import compact from 'lodash/fp/compact';
import uniqBy from 'lodash/fp/uniqBy';
import sortBy from 'lodash/fp/sortBy';
import debug from 'debug';
import { Downloader } from '../lib/downloader';
import { createTypedResolvers } from './createTypedResolvers';
import { BaseManifest } from '../manifest';

const dbg = debug('c2pa:resolvers:editsAndActivity');
export interface AdobeDictionaryAssertion {
  url: string;
}
declare module '../assertions' {
  interface ExtendedAssertions {
    'adobe.dictionary': AdobeDictionaryAssertion;
    'com.adobe.dictionary': AdobeDictionaryAssertion;
  }
}

export interface TranslatedDictionaryCategory {
  id: string;
  icon?: string;
  label: string;
  description: string;
}

const UNCATEGORIZED_ID = 'UNCATEGORIZED';

const CATEGORY_DICTIONARY = {
  COLOR_ADJUSTMENTS: {
    label: 'Color adjustments',
    description: 'Changes to tone, saturation, etc.',
  },
  CONVERSION: {
    label: 'Conversion',
    description: 'The format of the asset was changed',
  },
  CREATION: {
    label: 'Creation',
    description: 'The asset was first created',
  },
  TRANSFORM: {
    label: 'Size and position adjustments',
    description: 'Changed size, orientation, direction, or position',
  },
  PAINTING: {
    label: 'Paint tools',
    description: 'Edited with brushes or eraser tools',
  },
  EDITING: {
    label: 'Editing',
    description:
      "Generalized actions that would be considered 'editorial transformations' of the content",
  },
  FILTERING: {
    label: 'Filtering',
    description: 'Changes to appearance with applied filters, styles, etc.',
  },
  OPENING: {
    label: 'Opening',
    description:
      "An existing asset was opened and is being set as the 'parentOf' ingredient",
  },
  COMPOSITING: {
    label: 'Combined assets',
    description: 'Composited 2 or more assets',
  },
  PUBLISHING: {
    label: 'Publishing',
    description: 'Asset is released to a wider audience',
  },
  REMOVING: {
    label: 'Removing',
    description: 'A component ingredient was removed',
  },
  UNKNOWN: {
    label: 'Unknown',
    description:
      'Something happened, but the claim_generator cannot specify what',
  },
};

const ACTION_CATEGORY_MAP: Record<string, keyof typeof CATEGORY_DICTIONARY> = {
  'c2pa.color_adjustments': 'COLOR_ADJUSTMENTS',
  'c2pa.converted': 'CONVERSION',
  'c2pa.created': 'CREATION',
  'c2pa.cropped': 'TRANSFORM',
  'c2pa.drawing': 'PAINTING',
  'c2pa.edited': 'EDITING',
  'c2pa.filtered': 'FILTERING',
  'c2pa.opened': 'OPENING',
  'c2pa.orientation': 'TRANSFORM',
  'c2pa.placed': 'COMPOSITING',
  'c2pa.published': 'PUBLISHING',
  'c2pa.removed': 'REMOVING',
  'c2pa.repackaged': 'CONVERSION',
  'c2pa.resized': 'TRANSFORM',
  'c2pa.transcoded': 'CONVERSION',
  'c2pa.unknown': 'UNKNOWN',
};

/**
 * Uses the dictionary to translate an action name into category information
 */
function translateActionName(
  dictionary: AdobeDictionary,
  actionId: string,
  locale: string,
  iconVariant: IconVariant,
): TranslatedDictionaryCategory | null {
  const categoryId = dictionary.actions[actionId]?.category ?? UNCATEGORIZED_ID;
  if (categoryId === UNCATEGORIZED_ID) {
    dbg('Could not find category for actionId', actionId);
  }
  const category = dictionary.categories[categoryId];
  if (category) {
    return {
      id: categoryId,
      icon: category.icon?.replace('{variant}', iconVariant),
      label: category.labels[locale],
      description: category.descriptions[locale],
    };
  }
  return null;
}

/**
 * Pipeline to convert categories from the dictionary into a structure suitable for the
 * edits and activity web component. This also makes sure the categories are unique and sorted.
 */
const processCategories = flow(
  compact,
  uniqBy<EditCategory>((category) => category.id),
  sortBy((category) => category.label),
);

function getC2paCategorizedActions(
  manifest: BaseManifest<any>,
): TranslatedDictionaryCategory[] | null {
  const actions = manifest.assertions.get('c2pa.actions')?.data.actions;

  if (!actions) {
    return null;
  }

  const uniqueActionLabels = actions
    ?.map(({ action }) => ACTION_CATEGORY_MAP[action])
    .filter((val, idx, self) => self.indexOf(val) === idx)
    .map((category) => ({
      id: category,
      icon: undefined,
      ...CATEGORY_DICTIONARY[category],
    }));

  return uniqueActionLabels;
}

async function getPhotoshopCategorizedActions(
  manifest: BaseManifest<any>,
  locale = 'en-US',
  iconVariant: IconVariant = 'dark',
): Promise<TranslatedDictionaryCategory[] | null> {
  const dictionaryUrl = manifest.assertions.get('adobe.dictionary')?.data.url;
  const actions = manifest.assertions.get('c2pa.actions')?.data.actions;

  if (!dictionaryUrl || !actions) return null;

  const dictionary = await Downloader.cachedGetJson<AdobeDictionary>(
    dictionaryUrl,
  );

  const categories = processCategories(
    actions.map((action) =>
      translateActionName(
        dictionary,
        // TODO: This should be resolved once we reconcile dictionary definitions
        action.parameters?.name ?? action.action,
        locale,
        iconVariant,
      ),
    ),
  );

  return categories;
}

async function getCategorizedActions(manifest: BaseManifest<any>) {
  if (manifest.assertions.get('adobe.dictionary')) {
    return await getPhotoshopCategorizedActions(manifest);
  }

  return getC2paCategorizedActions(manifest);
}

type IconVariant = 'light' | 'dark';

export interface AdobeDictionary {
  categories: {
    [categoryId: string]: AdobeDictionaryCategory;
  };
  actions: {
    [actionId: string]: AdobeDictionaryAction;
  };
}
export interface AdobeDictionaryCategory {
  icon: string;
  labels: {
    [locale: string]: string;
  };
  descriptions: {
    [locale: string]: string;
  };
}

export interface AdobeDictionaryAction {
  labels: {
    [isoLangCode: string]: string;
  };
  category: string;
}

export interface EditCategory {
  id: string;
  icon: string;
  label: string;
  description: string;
}

export const editsAndActivity = createTypedResolvers({
  editsAndActivity: {
    get: (manifest) => getCategorizedActions.bind(null, manifest),
    // @TODO how to handle parameterized calls?
    getSerializable: async (manifest) => getCategorizedActions(manifest) as any,
  },
});

export type EditsAndActivityResolver = typeof editsAndActivity;
