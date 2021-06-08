import * as vscode from 'vscode';
import * as path from 'path';

class Change implements vscode.SourceControlResourceState {
	
	command?: vscode.Command | undefined;
	// decorations?: vscode.SourceControlResourceDecorations | undefined;
	// contextValue?: string | undefined;

	constructor(
		readonly resourceUri: vscode.Uri,
		readonly checkpointUri: vscode.Uri
	) {
		this.command = {
			command: 'vscode.diff',
			title: 'Open Comparison',
			arguments: [this.checkpointUri, this.resourceUri, '', undefined]
		}
	}
}

export async function activate(context: vscode.ExtensionContext) {
	const jupyterCheckpoint = vscode.scm.createSourceControl('jupyter-checkpoint', 'Jupyter Checkpoint');
	jupyterCheckpoint.inputBox.visible = false;
	const group = jupyterCheckpoint.createResourceGroup('changes', 'Changes');

	const update = async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (workspaceFolders) {
			const files: [vscode.Uri, vscode.Uri][] = [];
			const ret = workspaceFolders.map(async folder => {
				const folderUri = folder.uri;
				const checkpointUri = vscode.Uri.joinPath(folderUri, '.ipynb_checkpoints');
				const checkpointFiles = await vscode.workspace.findFiles('.ipynb_checkpoints/**/*.ipynb');
				checkpointFiles.forEach(cpFile => {
					const relativePath = path.relative(checkpointUri.fsPath, cpFile.fsPath);
					const fileUri = vscode.Uri.joinPath(folderUri, relativePath.replace(/-checkpoint\.ipynb$/g, '.ipynb'));
					files.push([fileUri, cpFile]);
				});
			});
	
			await Promise.all(ret);
	
			let changes: Change[] = [];
	
			await Promise.all(files.map(async fileData => {
				const fileUri = fileData[0];
				const checkpointUri = fileData[1];
				try {
					const fileStats = await vscode.workspace.fs.stat(fileUri);
					const checkpointStats = await vscode.workspace.fs.stat(checkpointUri);
					console.log(fileStats, checkpointStats);
		
					if (checkpointStats.mtime < fileStats.mtime) {
						changes.push(new Change(fileUri, checkpointUri));
					}
				} catch (e) {
					return;
				}
			}));
	
			group.resourceStates = changes;
		}
	}

	await update();

	const fileWatch = vscode.workspace.createFileSystemWatcher('**/*.ipynb');
	fileWatch.onDidChange(() => {
		update();
	});

	fileWatch.onDidChange(() => {
		update();
	});

	fileWatch.onDidDelete(() => {
		update();
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
