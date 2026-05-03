#!/usr/bin/env node

import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Yazio } from 'yazio';
import { v4 as uuidv4 } from "uuid";

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
import {
  GetFoodEntriesInputSchema,
  GetDailySummaryInputSchema,
  GetUserInfoInputSchema,
  GetUserWeightInputSchema,
  GetWaterIntakeInputSchema,
  SearchProductsInputSchema,
  GetProductInputSchema,
  GetUserExercisesInputSchema,
  GetUserSettingsInputSchema,
  GetUserSuggestedProductsInputSchema,
  AddConsumedItemInputSchema,
  RemoveConsumedItemInputSchema,
  AddWaterIntakeInputSchema,
  GetDietaryPreferencesInputSchema,
  GetUserGoalsInputSchema,
  type GetFoodEntriesInput,
  type GetDailySummaryInput,
  type GetWaterIntakeInput,
  type SearchProductsInput,
  type GetProductInput,
  type GetUserExercisesInput,
  type GetUserSuggestedProductsInput,
  type AddConsumedItemInput,
  type RemoveConsumedItemInput,
  CreateCustomProductInputSchema,
  DeleteCustomProductInputSchema,
  GetUserProductsInputSchema,
  type CreateCustomProductInput,
  type DeleteCustomProductInput,
  type GetUserProductsInput,
  GetUserRecipesInputSchema,
  GetRecipeInputSchema,
  GetUserMealsInputSchema,
  type GetUserRecipesInput,
  type GetRecipeInput,
  type GetUserMealsInput,
  type AddWaterIntakeInput,
} from './schemas.js';
import type {
  YazioExerciseOptions,
  YazioSuggestedProductsOptions,
  YazioAddWaterIntakeOptions
} from './types.js';

class YazioMcpServer {
  private server: McpServer;
  private yazioClient: Yazio | null = null;

  constructor() {
    this.server = new McpServer({
      name: 'yazio-mcp',
      version,
    });

    this.setupToolHandlers();
    this.setupPromptHandlers();
    this.setupErrorHandling();
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const username = process.env.YAZIO_USERNAME;
    const password = process.env.YAZIO_PASSWORD;

    if (!username || !password) {
      console.error('❌ YAZIO_USERNAME and YAZIO_PASSWORD environment variables are required');
      console.error('💡 Please set these environment variables with your Yazio account credentials');
      process.exit(1);
    }

    try {
      this.yazioClient = new Yazio({
        credentials: {
          username,
          password
        }
      });
      // Test the connection
      await this.yazioClient.user.get();
      console.error('✅ Successfully authenticated with Yazio using environment variables');
      this.extendWaterIntakeSupport(this.yazioClient);
    } catch (error) {
      console.error('❌ Failed to authenticate with Yazio:', (error as Error).message);
      console.error('💡 Please check your YAZIO_USERNAME and YAZIO_PASSWORD environment variables');
      process.exit(1);
    }
  }

  // Extend yazio client package with addWaterIntake method
  // Discussion https://github.com/juriadams/yazio/issues/3
  private extendWaterIntakeSupport(client: Yazio): void {
    // @ts-expect-error - Monkey-patching yazio client to add missing method
    client.user.addWaterIntake = async (entries: YazioAddWaterIntakeOptions): Promise<void> => {
      // @ts-expect-error - Accessing internal auth token from yazio client
      const token = client.auth.token.access_token;

      // Access internal HTTP client or make direct fetch call
      // Try to access base URL from client, fallback to known API URL
      const baseUrl = (client as Yazio & { baseUrl?: string }).baseUrl || 'https://yzapi.yazio.com/v15';

      const response = await fetch(`${baseUrl}/user/water-intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(entries),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add water intake: ${response.status} ${response.statusText} - ${errorText}`);
      }
    };
  }

  private setupErrorHandling(): void {
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.registerTool(
      'get_user',
      {
        description: 'Get Yazio user profile information',
        inputSchema: GetUserInfoInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async () => {
        return await this.getUser();
      }
    );

    this.server.registerTool(
      'get_user_consumed_items',
      {
        description: 'Get food entries for a specific date',
        inputSchema: GetFoodEntriesInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async (args: GetFoodEntriesInput) => {
        return await this.getUserConsumedItems(args);
      }
    );

    this.server.registerTool(
      'get_user_dietary_preferences',
      {
        description: 'Get user dietary preferences and restrictions',
        inputSchema: GetDietaryPreferencesInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async () => {
        return await this.getUserDietaryPreferences();
      }
    );

    this.server.registerTool(
      'get_user_exercises',
      {
        description: 'Get user exercise data for a date or date range',
        inputSchema: GetUserExercisesInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async (args: GetUserExercisesInput) => {
        return await this.getUserExercises(args);
      }
    );

    this.server.registerTool(
      'get_user_goals',
      {
        description: 'Get user nutrition and fitness goals',
        inputSchema: GetUserGoalsInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async () => {
        return await this.getUserGoals();
      }
    );

    this.server.registerTool(
      'get_user_settings',
      {
        description: 'Get user settings and preferences',
        inputSchema: GetUserSettingsInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async () => {
        return await this.getUserSettings();
      }
    );

    this.server.registerTool(
      'get_user_suggested_products',
      {
        description: 'Get product suggestions for the user',
        inputSchema: GetUserSuggestedProductsInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (args: GetUserSuggestedProductsInput) => {
        return await this.getUserSuggestedProducts(args);
      }
    );

    this.server.registerTool(
      'get_user_water_intake',
      {
        description: 'Get water intake data for a specific date',
        inputSchema: GetWaterIntakeInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async (args: GetWaterIntakeInput) => {
        return await this.getUserWaterIntake(args);
      }
    );

    this.server.registerTool(
      'get_user_weight',
      {
        description: 'Get user weight data',
        inputSchema: GetUserWeightInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async () => {
        return await this.getUserWeight();
      }
    );

    this.server.registerTool(
      'get_user_daily_summary',
      {
        description: 'Get daily nutrition summary for a specific date',
        inputSchema: GetDailySummaryInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async (args: GetDailySummaryInput) => {
        return await this.getUserDailySummary(args);
      }
    );

    this.server.registerTool(
      'search_products',
      {
        description: 'Search for food products in Yazio database. You can optionally specify user\'s sex, country and locale of the products to search for.',
        inputSchema: SearchProductsInputSchema,
        // outputSchema: SearchProductsOutputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (args: SearchProductsInput) => {
        return await this.searchProducts(args);
      }
    );

    this.server.registerTool(
      'get_product',
      {
        description: 'Get detailed information about a specific product by ID',
        inputSchema: GetProductInputSchema,
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (args: GetProductInput) => {
        return await this.getProduct(args);
      }
    );

    this.server.registerTool(
      'add_user_consumed_item',
      {
        description: 'Add a food item to user consumption log',
        inputSchema: AddConsumedItemInputSchema,
        annotations: {
          readOnlyHint: false,
          idempotentHint: false,
        },
      },
      async (args: AddConsumedItemInput) => {
        return await this.addUserConsumedItem(args);
      }
    );

    this.server.registerTool(
      'remove_user_consumed_item',
      {
        description: 'Remove a food item from user consumption log',
        inputSchema: RemoveConsumedItemInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
        },
      },
      async (args: RemoveConsumedItemInput) => {
        return await this.removeUserConsumedItem(args);
      }
    );

    this.server.registerTool(
      'add_user_water_intake',
      {
        description: 'Log a water intake entry. Requires date (YYYY-MM-DD HH:mm:ss format) and cumulative water_intake in milliliters (ml). Always get the latest water intake first and add the new amount to calculate the cumulative value.',
        inputSchema: AddWaterIntakeInputSchema,
        annotations: {
          readOnlyHint: false,
          idempotentHint: false,
        },
      },
      async (args: AddWaterIntakeInput) => {
        return await this.addUserWaterIntake(args);
      }
    );
  
// --- Custom Products ---
    this.server.registerTool(
      'get_user_products',
      {
        description: 'Get list of IDs of user custom products',
        inputSchema: GetUserProductsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        return await this.getUserProducts();
      }
    );

    this.server.registerTool(
      'create_custom_product',
      {
        description: 'Create a new private custom product in Yazio. Provide nutrition per 100g/ml: energy_kcal, protein, carbs, fat.',
        inputSchema: CreateCustomProductInputSchema,
        annotations: { readOnlyHint: false, idempotentHint: false },
      },
      async (args: CreateCustomProductInput) => {
        return await this.createCustomProduct(args);
      }
    );

    this.server.registerTool(
      'delete_custom_product',
      {
        description: 'Delete a custom product by ID',
        inputSchema: DeleteCustomProductInputSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args: DeleteCustomProductInput) => {
        return await this.deleteCustomProduct(args);
      }
    );

    this.server.registerTool(
      'get_user_recipes',
      {
        description: 'Get list of user recipe IDs',
        inputSchema: GetUserRecipesInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        return await this.getUserRecipes();
      }
    );

    this.server.registerTool(
      'get_recipe',
      {
        description: 'Get detailed information about a recipe by ID (name, nutrients, portion_count, products, recipe_portions)',
        inputSchema: GetRecipeInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async (args: GetRecipeInput) => {
        return await this.getRecipe(args);
      }
    );

    this.server.registerTool(
      'get_user_meals',
      {
        description: 'Get list of user meals (saved combinations of products)',
        inputSchema: GetUserMealsInputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true },
      },
      async () => {
        return await this.getUserMeals();
      }
    );

  }

  private setupPromptHandlers(): void {
    this.server.registerPrompt(
      'add_food_item',
      {
        title: 'Add Food Item to Log',
        description: 'Guide for adding a food item to the user\'s consumption log',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `To add a food item to the user's consumption log, follow these steps:

1. **Search for the product**: Use the \`search_products\` tool with a query string (e.g., "chicken breast", "apple", "pasta"), optionally specifying user's sex, country and locale of the products to search for. This will return a list of matching products with their IDs and short information about the product and serving.

2. **Clarify the product**: If multiple products are found, ask the user to clarify which product they want to use.

3. **Get product details**: Use the \`get_product\` tool with the \`product_id\` from the search results. This will show you full information about the product and serving:
   - Available serving types (e.g., "portion", "gram", "piece", "cup") and their amounts in base units (g or ml)
   - Base unit (g or ml)

4. **Clarify the serving**: If the user doesn't provide a serving type and quantity, ask them to clarify the serving type provided by previous step and quantity they want to add.

5. **Add the consumed item**: Use the \`add_user_consumed_item\` tool with:
   - \`product_id\`: The UUID from step 1
   - \`date\`: Date in YYYY-MM-DD format
   - \`daytime\`: One of: "breakfast", "lunch", "dinner", or "snack"
   - \`serving\`: Use a serving type from step 2 (e.g., "portion", "piece", "cup") OR base unit (g or ml)
   - \`serving_quantity\`: Quantity of the serving type (e.g., 1, 2, 0.5)
   - \`amount\`: Direct amount in base units (g or ml). If serving type is provided, use the amount of the serving type * serving_quantity. If serving type is not provided, use the amount of the base unit.

**Important Notes**:
- Always search first if you don't have a product_id
- Check product details to understand available serving types, base unit (g or ml) and amount in serving
- The date should be in ISO format (YYYY-MM-DD)
- You can use serving or base unit approach:
  1. serving type + serving quantity + amount (amount for selected serving type multiplied by serving quantity)
  2. amount in g/ml - serving fields could be omitted
Example:
  1. "I ate 2 apples" - serving type "piece" which has 100g amount (from product details) + serving quantity 2 + amount 200g
  2. "I ate 200g of chicken breast" - amount 200g
- Always provide amount in base units (g or ml), not in servings.
`
              }
            }
          ]
        };
      }
    );

    this.server.registerPrompt(
      'remove_food_item',
      {
        title: 'Remove Food Item from Log',
        description: 'Guide for removing a food item from the user\'s consumption log',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `To remove a food item from the user's consumption log, follow these steps:

1. **Get consumed items**: Use the \`get_user_consumed_items\` tool with the \`date\` parameter (in YYYY-MM-DD format) to retrieve all food entries for that date.

2. **Identify the item**: From the returned list of consumed items, identify the specific item you want to remove. Each item will have:
   - \`id\`: The unique identifier for the consumed item (this is what you need for removal)
   - \`product_id\`: The product identifier
   - \`name\`: The product name
   - \`date\`: The date it was consumed
   - \`daytime\`: The meal type (breakfast, lunch, dinner, snack)
   - Other details like amount, serving, etc.

3. **Remove the item**: Use the \`remove_user_consumed_item\` tool with:
   - \`itemId\`: The \`id\` field from the consumed item you identified in step 2

**Important Notes**:
- You must first retrieve the consumed items to get the item ID
- The \`itemId\` is different from \`product_id\` - use the \`id\` field from the consumed item
- The date should be in ISO format (YYYY-MM-DD)
- If multiple items match the description, you may need to ask the user to clarify which specific item to remove`
              }
            }
          ]
        };
      }
    );

    this.server.registerPrompt(
      'add_water_intake',
      {
        title: 'Add Water Intake to Log',
        description: 'Guide for adding water intake entries to the user\'s log',
      },
      async () => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `To add water intake to the user's log, follow these steps:

1. **Get current water intake**: Use the \`get_user_water_intake\` tool with the \`date\` parameter (in YYYY-MM-DD format) to retrieve the current cumulative water intake for that date. The response will contain a \`water_intake\` field with the current cumulative value in milliliters (ml).

2. **Calculate cumulative value**: Add the new water intake amount (in ml) that the user wants to add to the existing \`water_intake\` value from step 1. This gives you the new cumulative water intake value.

3. **Add the water intake entry**: Use the \`add_user_water_intake\` tool with a single object (the tool will automatically wrap it in an array when sending to the API):
   - \`date\`: Date and time in format "YYYY-MM-DD HH:mm:ss" (e.g., "2025-12-18 12:00:00")
   - \`water_intake\`: The cumulative water intake in milliliters (ml) - this should be the previous cumulative value plus the new intake amount

**Important Notes**:
- Always get the latest water intake first to ensure you're adding to the correct cumulative value
- The \`water_intake\` field must be cumulative (previous total + new intake), not just the new amount
- The date format must be "YYYY-MM-DD HH:mm:ss" with both date and time
- Water intake is measured in milliliters (ml)
- The tool accepts a single object (not an array) - it will be automatically sent as a single-item array to the API

**Example**:
- Current water intake for 2025-12-18: 500ml
- User says: "I want to add 250ml"
- Get latest: 500ml
- Calculate: 500 + 250 = 750ml
- Call tool with: \`{ date: "2025-12-18 12:00:00", water_intake: 750 }\`
- The tool sends: \`[{ date: "2025-12-18 12:00:00", water_intake: 750 }]\` to the API`
              }
            }
          ]
        };
      }
    );
  }

  private async ensureAuthenticated(): Promise<Yazio> {
    if (!this.yazioClient) {
      throw new Error('Yazio client not initialized. Check environment variables.');
    }
    return this.yazioClient;
  }


  private async getUserConsumedItems(args: GetFoodEntriesInput) {
    const client = await this.ensureAuthenticated();

    try {
      const foodEntries = await client.user.getConsumedItems({ date: new Date(args.date) });

      // Enrich products with names and producer info
      const enrichedProducts = await Promise.all(
        foodEntries.products.map(async (item) => {
          try {
            const product = await client.products.get(item.product_id);
            return {
              ...item,
              product_name: product?.name || null,
              product_producer: product?.producer || null,
            };
          } catch (error) {
            // If product fetch fails, return item without enrichment
            console.error(`Failed to fetch product ${item.product_id}:`, error);
            return {
              ...item,
              product_name: null,
              product_producer: null,
            };
          }
        })
      );

      // Enrich recipe_portions with names
      const recipePortions = (foodEntries.recipe_portions ?? []) as Array<Record<string, unknown>>;
      // @ts-expect-error - accessing internal auth token
      const recipeToken = client.auth.token.access_token;
      const enrichedRecipePortions = await Promise.all(
        recipePortions.map(async (item) => {
          const recipeId = item.recipe_id as string | undefined;
          if (!recipeId) return item;
          try {
            const resp = await fetch(`https://yzapi.yazio.com/v15/user/recipes/${recipeId}`, {
              headers: { 'Authorization': `Bearer ${recipeToken}` },
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const recipe = await resp.json() as { name?: string };
            return {
              ...item,
              recipe_name: recipe?.name || null,
            };
          } catch (error) {
            console.error(`Failed to fetch recipe ${recipeId}:`, error);
            return {
              ...item,
              recipe_name: null,
            };
          }
        })
      );

      const enrichedFoodEntries = {
        ...foodEntries,
        products: enrichedProducts,
        recipe_portions: enrichedRecipePortions,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: `Food entries for ${args.date}:\n\n${JSON.stringify(enrichedFoodEntries, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get food entries: ${error}`);
    }
  }

  private async getUser() {
    const client = await this.ensureAuthenticated();

    try {
      const userInfo = await client.user.get();

      return {
        content: [
          {
            type: 'text' as const,
            text: `User info:\n\n${JSON.stringify(userInfo, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get user info: ${error}`);
    }
  }

  private async getUserDailySummary(args: GetDailySummaryInput) {
    const client = await this.ensureAuthenticated();

    try {
      const summary = await client.user.getDailySummary({ date: new Date(args.date) });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Daily summary for ${args.date}:\n\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get daily summary: ${error}`);
    }
  }

  private async getUserWeight() {
    const client = await this.ensureAuthenticated();

    try {
      // Yazio getWeight doesn't support date ranges, just single date
      const weight = await client.user.getWeight();

      return {
        content: [
          {
            type: 'text' as const,
            text: `User weight data:\n\n${JSON.stringify(weight, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get user weight: ${error}`);
    }
  }

  private async getUserWaterIntake(args: GetWaterIntakeInput) {
    const client = await this.ensureAuthenticated();

    try {
      const waterIntake = await client.user.getWaterIntake({ date: new Date(args.date) });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Water intake for ${args.date}:\n\n${JSON.stringify(waterIntake, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get water intake: ${error}`);
    }
  }

  private async searchProducts(args: SearchProductsInput) {
    const client = await this.ensureAuthenticated();

    try {
      const products = await client.products.search(args);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Products:\n\n${JSON.stringify(products, null, 2)}`,
          },
        ],
        products,
      };
    } catch (error) {
      throw new Error(`Failed to search products: ${error}`);
    }
  }

  private async getProduct(args: GetProductInput) {
    const client = await this.ensureAuthenticated();

    try {
      const product = await client.products.get(args.id);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Product details for ID "${args.id}":\n\n${JSON.stringify(product, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get product: ${error}`);
    }
  }

  private async getUserExercises(args: GetUserExercisesInput) {
    const client = await this.ensureAuthenticated();

    try {
      const apiOptions: YazioExerciseOptions = {};
      if (args.date) {
        apiOptions.date = args.date;
      }

      const exercises = await client.user.getExercises(apiOptions);

      return {
        content: [
          {
            type: 'text' as const,
            text: `User exercises:\n\n${JSON.stringify(exercises, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get user exercises: ${error}`);
    }
  }

  private async getUserSettings() {
    const client = await this.ensureAuthenticated();

    try {
      const settings = await client.user.getSettings();

      return {
        content: [
          {
            type: 'text' as const,
            text: `User settings:\n\n${JSON.stringify(settings, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get user settings: ${error}`);
    }
  }

  private async getUserSuggestedProducts(args: GetUserSuggestedProductsInput) {
    const client = await this.ensureAuthenticated();

    try {
      const options: YazioSuggestedProductsOptions = {
        daytime: 'breakfast',
        ...args
      };
      const suggestions = await client.user.getSuggestedProducts(options);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Product suggestions:\n\n${JSON.stringify(suggestions, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get product suggestions: ${error}`);
    }
  }

  private async addUserConsumedItem(args: AddConsumedItemInput) {
    const client = await this.ensureAuthenticated();

    try {
      await client.user.addConsumedItem({
        ...args,
        id: uuidv4(),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Successfully added consumed item`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to add consumed item: ${error}`);
    }
  }

  private async removeUserConsumedItem(args: RemoveConsumedItemInput) {
    const client = await this.ensureAuthenticated();

    try {
      const result = await client.user.removeConsumedItem(args.itemId);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Successfully removed consumed item with ID: ${args.itemId}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to remove consumed item: ${error}`);
    }
  }

  private async addUserWaterIntake(args: AddWaterIntakeInput) {
    const client = await this.ensureAuthenticated();

    try {
      // @ts-expect-error - Using monkey-patched method
      await client.user.addWaterIntake([{
        date: args.date, // Already in "YYYY-MM-DD HH:mm:ss" format
        water_intake: args.water_intake,
      }]);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Successfully logged water intake entry`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to add water intake: ${error}`);
    }
  }

  private async getUserDietaryPreferences() {
    const client = await this.ensureAuthenticated();

    try {
      const preferences = await client.user.getDietaryPreferences();

      return {
        content: [
          {
            type: 'text' as const,
            text: `Dietary preferences:\n\n${JSON.stringify(preferences, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get dietary preferences: ${error}`);
    }
  }

  private async getUserGoals() {
    const client = await this.ensureAuthenticated();

    try {
      const goals = await client.user.getGoals({});

      return {
        content: [
          {
            type: 'text' as const,
            text: `User goals:\n\n${JSON.stringify(goals, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get user goals: ${error}`);
    }
  }


  private async getUserProducts() {
    const client = await this.ensureAuthenticated();
    // @ts-expect-error - accessing internal auth token
    const token = client.auth.token.access_token;
    const resp = await fetch('https://yzapi.yazio.com/v15/user/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ids = await resp.json();
    return { content: [{ type: 'text' as const, text: `Custom product IDs:\n\n${JSON.stringify(ids, null, 2)}` }] };
  }

  private async createCustomProduct(args: CreateCustomProductInput) {
    const client = await this.ensureAuthenticated();
    // @ts-expect-error - accessing internal auth token
    const token = client.auth.token.access_token;

    // Конвертируем ккал -> кДж/г (Yazio хранит энергию в кДж на грамм)
    // 1 ккал = 4.184 кДж, делим на 100 чтобы получить на 1г
    const body = {
      id: uuidv4(),
      name: args.name,
      category: args.category,
      base_unit: args.base_unit,
      is_private: args.is_private,
      nutrients: {
        'energy.energy': args.energy_kcal / 100,
        'nutrient.protein': args.protein / 100,
        'nutrient.carb': args.carbs / 100,
        'nutrient.fat': args.fat / 100,
      },
      ...(args.producer ? { producer: args.producer } : {}),
    };

    const resp = await fetch('https://yzapi.yazio.com/v15/user/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Failed to create product: ${resp.status} - ${err}`);
    }

    return { content: [{ type: 'text' as const, text: `Successfully created custom product "${args.name}" with ID: ${body.id}` }] };
  }

  private async deleteCustomProduct(args: DeleteCustomProductInput) {
    const client = await this.ensureAuthenticated();
    // @ts-expect-error - accessing internal auth token
    const token = client.auth.token.access_token;

    const resp = await fetch(`https://yzapi.yazio.com/v15/user/products/${args.product_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Failed to delete product: ${resp.status} - ${err}`);
    }

    return { content: [{ type: 'text' as const, text: `Successfully deleted custom product with ID: ${args.product_id}` }] };
  }


  private async getUserRecipes() {
    const client = await this.ensureAuthenticated();
    // @ts-expect-error - accessing internal auth token
    const token = client.auth.token.access_token;
    const resp = await fetch('https://yzapi.yazio.com/v15/user/recipes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error(`Failed to get recipes: ${resp.status}`);
    const recipeIds = await resp.json() as string[];
    return { content: [{ type: 'text' as const, text: `User recipes (${recipeIds.length} total):\n\n${JSON.stringify(recipeIds, null, 2)}` }] };
  }

  private async getRecipe(args: GetRecipeInput) {
    const client = await this.ensureAuthenticated();
    // @ts-expect-error - accessing internal auth token
    const token = client.auth.token.access_token;
    const resp = await fetch(`https://yzapi.yazio.com/v15/recipes/${args.recipe_id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error(`Failed to get recipe: ${resp.status}`);
    const recipe = await resp.json();
    return { content: [{ type: 'text' as const, text: `Recipe details:\n\n${JSON.stringify(recipe, null, 2)}` }] };
  }

  private async getUserMeals() {
    const client = await this.ensureAuthenticated();
    // @ts-expect-error - accessing internal auth token
    const token = client.auth.token.access_token;
    const resp = await fetch('https://yzapi.yazio.com/v15/user/meals', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error(`Failed to get meals: ${resp.status}`);
    const meals = await resp.json();
    return { content: [{ type: 'text' as const, text: `User meals (${meals.length} total):\n\n${JSON.stringify(meals, null, 2)}` }] };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Yazio MCP server running on stdio');
  }
}

const server = new YazioMcpServer();
server.run().catch(console.error);
