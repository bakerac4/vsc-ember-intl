export class TransUnitBuilder {

	public static createTransUnit(id: string, source?: string): string {
		const builder = new TransUnitBuilder();
		return builder.build(id, source);
	}
	
	public build(id: string, source?: string): string {
		return `"${id}": "${source}",
		`;
	}
}
