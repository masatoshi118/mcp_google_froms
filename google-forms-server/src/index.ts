#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Request
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// 環境変数から認証情報を取得
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables are required');
}

class GoogleFormsServer {
  private server: Server;
  private oauth2Client: OAuth2Client;
  private forms: any;

  constructor() {
    this.server = new Server(
      {
        name: 'google-forms-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // OAuth2クライアントの初期化
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET
    );
    this.oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN
    });

    // Google Forms APIの初期化
    this.forms = google.forms({
      version: 'v1',
      auth: this.oauth2Client
    });

    this.setupToolHandlers();
    
    // エラーハンドリング
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_form',
          description: '新しいGoogleフォームを作成します',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'フォームのタイトル',
              },
              description: {
                type: 'string',
                description: 'フォームの説明（オプション）',
              }
            },
            required: ['title'],
          },
        },
        {
          name: 'add_text_question',
          description: 'フォームにテキスト質問を追加します',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'フォームID',
              },
              questionTitle: {
                type: 'string',
                description: '質問のタイトル',
              },
              required: {
                type: 'boolean',
                description: '必須かどうか（オプション、デフォルトはfalse）',
              }
            },
            required: ['formId', 'questionTitle'],
          },
        },
        {
          name: 'add_multiple_choice_question',
          description: 'フォームに選択式質問を追加します',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'フォームID',
              },
              questionTitle: {
                type: 'string',
                description: '質問のタイトル',
              },
              options: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: '選択肢の配列',
              },
              required: {
                type: 'boolean',
                description: '必須かどうか（オプション、デフォルトはfalse）',
              }
            },
            required: ['formId', 'questionTitle', 'options'],
          },
        },
        {
          name: 'get_form',
          description: 'フォームの詳細を取得します',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'フォームID',
              }
            },
            required: ['formId'],
          },
        },
        {
          name: 'get_form_responses',
          description: 'フォームの回答を取得します',
          inputSchema: {
            type: 'object',
            properties: {
              formId: {
                type: 'string',
                description: 'フォームID',
              }
            },
            required: ['formId'],
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      try {
        switch (request.params.name) {
          case 'create_form':
            return await this.createForm(request.params.arguments);
          case 'add_text_question':
            return await this.addTextQuestion(request.params.arguments);
          case 'add_multiple_choice_question':
            return await this.addMultipleChoiceQuestion(request.params.arguments);
          case 'get_form':
            return await this.getForm(request.params.arguments);
          case 'get_form_responses':
            return await this.getFormResponses(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        console.error('Error in tool execution:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message || 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async createForm(args: any) {
    if (!args.title) {
      throw new McpError(ErrorCode.InvalidParams, 'Title is required');
    }

    const form: any = {
      info: {
        title: args.title,
        documentTitle: args.title,
      }
    };

    if (args.description) {
      form.info.description = args.description;
    }

    try {
      const response = await this.forms.forms.create({
        requestBody: form,
      });

      const formId = response.data.formId;
      const responderUri = `https://docs.google.com/forms/d/${formId}/viewform`;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              formId,
              title: args.title,
              description: args.description || '',
              responderUri,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error creating form:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create form: ${error.message}`
      );
    }
  }

  private async addTextQuestion(args: any) {
    if (!args.formId || !args.questionTitle) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Form ID and question title are required'
      );
    }

    try {
      // 現在のフォームを取得
      const form = await this.forms.forms.get({
        formId: args.formId,
      });

      // 新しい質問を追加するリクエストを作成
      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    textQuestion: {}
                  }
                }
              },
              location: {
                index: 0
              }
            }
          }
        ]
      };

      // フォームを更新
      const response = await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Text question added successfully',
              questionTitle: args.questionTitle,
              required: args.required || false,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding text question:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add text question: ${error.message}`
      );
    }
  }

  private async addMultipleChoiceQuestion(args: any) {
    if (!args.formId || !args.questionTitle || !args.options || !Array.isArray(args.options)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Form ID, question title, and options array are required'
      );
    }

    try {
      // 選択肢を作成
      const choices = args.options.map((option: string) => ({
        value: option
      }));

      // 新しい質問を追加するリクエストを作成
      const updateRequest = {
        requests: [
          {
            createItem: {
              item: {
                title: args.questionTitle,
                questionItem: {
                  question: {
                    required: args.required || false,
                    choiceQuestion: {
                      type: 'RADIO',
                      options: choices,
                    }
                  }
                }
              },
              location: {
                index: 0
              }
            }
          }
        ]
      };

      // フォームを更新
      const response = await this.forms.forms.batchUpdate({
        formId: args.formId,
        requestBody: updateRequest,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Multiple choice question added successfully',
              questionTitle: args.questionTitle,
              options: args.options,
              required: args.required || false,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error adding multiple choice question:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add multiple choice question: ${error.message}`
      );
    }
  }

  private async getForm(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const response = await this.forms.forms.get({
        formId: args.formId,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error getting form:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get form: ${error.message}`
      );
    }
  }

  private async getFormResponses(args: any) {
    if (!args.formId) {
      throw new McpError(ErrorCode.InvalidParams, 'Form ID is required');
    }

    try {
      const response = await this.forms.forms.responses.list({
        formId: args.formId,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error('Error getting form responses:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get form responses: ${error.message}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Forms MCP server running on stdio');
  }
}

const server = new GoogleFormsServer();
server.run().catch(console.error);
