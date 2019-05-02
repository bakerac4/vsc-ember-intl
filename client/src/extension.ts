import * as path from 'path';
import { workspace, ExtensionContext, commands, languages, window, Uri, WorkspaceEdit } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';
import { FileController } from './file.controller';
import { HoverController } from './hover.controller';
import { DefinitionController } from "./definition.controller";
import { ReferenceController } from "./reference.controller";
import RettouaCommands, { CodeActionsController } from './codeactions.controller';
import { RenameController } from './rename.controller';
import { CompletionItemController } from './completionItem.controller';

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			port: 6009,
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: 'file', language: 'handlebars' },
			{ scheme: 'file', language: 'json' },
			{ scheme: 'file', language: 'javascript' }
		],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},

	};

	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	client.start();
	const fileController = new FileController();
	const hoverController = new HoverController(client);
	const definitionController = new DefinitionController(client);
	const referencesController = new ReferenceController(client);
	const codeActionsController = new CodeActionsController(client);
	const renameController = new RenameController(client);
	const completionItemController = new CompletionItemController(client);

	client.onReady().then(_ => {

		fileController.processAngularFile(projects => {
			client.sendNotification('custom/projects', [projects]);

			fileController.processTranslations(() => {
				client.sendNotification('custom/translationsLoaded');

				fileController.processHtmlFiles(projects, (urls: any[]) => {
					client.sendNotification('custom/htmlFiles', [urls]);
				});
			});
		});

	});

	languages.registerHoverProvider({ scheme: 'file', language: 'handlebars' }, {
		provideHover: hoverController.getHover.bind(hoverController)
	});

	languages.registerDefinitionProvider({ scheme: 'file', language: 'handlebars' }, {
		provideDefinition: definitionController.getDefinition.bind(definitionController)
	});

	languages.registerReferenceProvider({ scheme: 'file', language: 'handlebars' }, {
		provideReferences: referencesController.getReferences.bind(referencesController)
	});

	languages.registerCodeActionsProvider({ scheme: 'file', language: 'handlebars' }, {
		provideCodeActions: codeActionsController.getActions.bind(codeActionsController)
	});

	languages.registerRenameProvider({ scheme: 'file', language: 'handlebars' }, {
		provideRenameEdits: renameController.rename.bind(renameController),
		prepareRename: renameController.prepareRename.bind(renameController)
	});

	languages.registerCompletionItemProvider({ scheme: 'file', language: 'handlebars' }, {
		provideCompletionItems: completionItemController.getItems.bind(completionItemController)
	});

	context.subscriptions.push(commands.registerCommand(RettouaCommands.GO_TO_FILE, (args) => {
		window.showTextDocument(Uri.file(args.uri), {
			selection: args.range
		});
	}, this));

	context.subscriptions.push(commands.registerCommand(RettouaCommands.GENERATE_TRANSLATION, (args) => {
		client.sendNotification('custom/generate_translations', [args]);
	}, this));

	context.subscriptions.push(commands.registerCommand(RettouaCommands.REMOVE_TRANSLATIONS, (args) => {
		client.sendNotification('custom/remove_translations', args);
	}, this));
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

