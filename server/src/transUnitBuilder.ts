export class TransUnitBuilder {

	public static createTransUnit(id: [string], source?: string): string {
		const builder = new TransUnitBuilder();
		if (id.length === 1) {
			return builder.build(id[0], source, true);
		} else {
			const reverse = id.reverse();
			const key = reverse.shift();
			let string = builder.build(key, source);
			reverse.forEach((key, index) => {
				string = builder.buildObjectString(key, string, index === reverse.length - 1 ? true : false);
			});
		
			return string;
		}
		
	}
	public buildObjectString(id: string, source: string, comma: boolean = false): string {
		return `"${id}": { ${source} }${comma ? ',\n' : ''}`;
	}

	public build(id: string, source?: string, comma: boolean = false): string {
		return `"${id}": "${source}"${comma ? ',\n': ''}`;
	}
}