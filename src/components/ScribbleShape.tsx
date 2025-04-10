import {
	Geometry2d,
	RecordProps,
	ShapeUtil,
	T,
	TLBaseShape,
	TLResizeInfo,
	SVGContainer,
	resizeBox,
	Rectangle2d,
} from 'tldraw'
import 'tldraw/tldraw.css'

// [1] Define the shape type
type IScribbleShape = TLBaseShape<
	'scribble-shape',
	{
		w: number
		h: number
		color: string
	}
>

// [2] Create the shape util
export class ScribbleShapeUtil extends ShapeUtil<IScribbleShape> {
	// [a] Define type and props
	static override type = 'scribble-shape' as const
	static override props: RecordProps<IScribbleShape> = {
		w: T.number,
		h: T.number,
		color: T.string,
	}

	// [b] Default props
	getDefaultProps(): IScribbleShape['props'] {
		return {
			w: 30,
			h: 30,
			color: '#000000',
		}
	}

	// [c] Behavior methods
	override canEdit() {
		return true
	}
	override canResize() {
		return true
	}
	override isAspectRatioLocked() {
		return true // Locking aspect ratio for the SVG
	}

	// [d] Geometry for hit testing
	getGeometry(shape: IScribbleShape): Geometry2d {
		return new Rectangle2d({
			width: shape.props.w,
			height: shape.props.h,
			isFilled: true,
		})
	}

	// [e] Handle resizing
	override onResize(shape: IScribbleShape, info: TLResizeInfo<IScribbleShape>) {
		return resizeBox(shape, info)
	}

	// [f] Component for rendering
	component(shape: IScribbleShape) {
		return (
			<SVGContainer>
				<svg xmlns="http://www.w3.org/2000/svg" width={shape.props.w} height={shape.props.h} viewBox="-22.259618759155273 -1.7853738069534302 39.06474685668945 39.358707427978516" strokeLinecap="round" strokeLinejoin="round">
					<defs />
					<g transform="scale(1)" opacity="1">
						<path d="M1.409,1.1101 T0.4652,2.1957 -1.2603,4.2329 -2.9521,6.2524 -4.921,8.5581 -7.1484,11.2197 -9.423,14.0236 -11.5293,16.6884 -13.3784,19.1186 -14.9209,21.2458 -16.2411,23.1122 -17.6307,25.2301 -18.7375,27.0938 -19.0812,27.7247 A1.7369,1.7369 0 0 1 -21.9642,25.7867 T-21.5012,25.2174 -20.0712,23.4654 -18.4198,21.4573 -16.9913,19.7022 -15.3924,17.6114 -13.5623,15.1296 -11.5206,12.3861 -9.3389,9.4814 -7.247,6.6954 -5.4255,4.268 -3.8294,2.1888 -2.2436,0.0615 -1.409,-1.1101 A1.7938,1.7938 0 0 1 1.409,1.1101 ZM-19.6817,25.2359 T-19.6227,25.26 -19.5638,25.2841 A1.7519,1.7519 0 0 1 -21.2603,28.3497 T-21.312,28.3126 -21.3638,28.2754 A1.7369,1.7369 0 0 1 -19.6817,25.2359 ZM-21.4758,25.425 T-20.521,24.6345 -18.6014,23.1006 -16.3246,21.3953 -13.4588,19.268 -9.3845,16.202 -4.9101,12.8949 -1.1945,10.2579 2.1405,7.9623 4.963,6.0929 7.0698,4.7209 9.2137,3.4313 11.4018,2.449 12.3038,2.1887 A1.7102,1.7102 0 0 1 12.9399,5.5494 T12.3037,5.5803 10.4754,6.0458 8.4188,6.9165 6.3416,8.1491 3.5936,10.0282 0.3436,12.3686 -3.2594,15.0683 -7.5944,18.4697 -11.5076,21.6834 -14.1796,24.0252 -16.3238,25.9246 -18.3053,27.4726 -19.3482,28.2088 A1.7519,1.7519 0 0 1 -21.4758,25.425 ZM14.1056,3.0185 T14.2673,3.2472 14.4291,3.4759 A1.7634,1.7634 0 0 1 11.3693,5.2298 T11.2537,4.9747 11.1381,4.7196 A1.7102,1.7102 0 0 1 14.1056,3.0185 ZM14.5903,4.8525 T14.4696,5.3697 13.8202,6.8383 12.543,8.8062 10.7455,11.0387 8.5033,13.6018 6.2159,16.2069 4.1173,18.6721 2.1096,21.1684 0.2299,23.6398 -1.2957,25.8017 -2.4682,27.6522 -3.4529,29.3415 -4.4904,31.3713 -5.1041,33.1523 -5.1417,33.7219 A1.802,1.802 0 0 1 -8.6579,32.9308 T-8.3596,32.0078 -7.2626,29.8254 -5.91,27.7608 -4.7345,26.099 -3.3945,24.2959 -1.8104,22.1305 0.0395,19.5644 1.9876,16.9498 3.9754,14.3621 6.0645,11.6519 7.995,9.0127 9.8587,6.2929 11.0327,4.3379 11.208,3.8532 A1.7634,1.7634 0 0 1 14.5903,4.8525 ZM-6.7075,31.5346 T-6.0922,31.5791 -3.9639,30.7606 -1.3401,29.2116 0.8027,27.8446 2.8859,26.4507 4.9567,25.0506 6.9143,23.7555 8.7171,22.6114 11.0667,21.3126 13.3381,20.2705 14.1248,19.9913 A1.8875,1.8875 0 0 1 15.1328,23.6294 T14.534,23.7341 12.6089,24.3907 10.4395,25.4201 8.6937,26.4567 6.8022,27.7033 4.773,29.1566 2.7144,30.6523 0.5882,32.1914 -1.6513,33.7467 -3.8687,34.9417 -6.0232,35.2543 -7.0921,35.1181 A1.802,1.802 0 0 1 -6.7075,31.5346 ZM16.1173,20.6497 T16.2588,20.8032 16.4003,20.9567 A1.9219,1.9219 0 0 1 13.3691,23.3203 T13.2547,23.1457 13.1403,22.971 A1.8875,1.8875 0 0 1 16.1173,20.6497 ZM16.7057,22.753 T16.3866,23.8034 15.1988,26.2912 13.481,29.0631 11.9911,31.5452 10.9839,33.8316 11.0831,34.0401 12.3959,32.9837 13.2432,32.8573 A2.1936,2.1936 0 0 1 13.9768,37.1827 T13.1351,37.3428 10.6243,37.5696 7.73,36.5123 6.6042,34.1905 7.2118,31.8348 8.4539,29.4442 10.0467,26.8876 11.6805,24.3405 12.7595,22.3208 13.0637,21.524 A1.9219,1.9219 0 0 1 16.7057,22.753 Z" strokeLinecap="round" fill={shape.props.color} />
					</g>
				</svg>
			</SVGContainer>
		)
	}

	// [g] Indicator for selection
	indicator(shape: IScribbleShape) {
		return (
			<rect
				width={shape.props.w}
				height={shape.props.h}
			/>
		)
	}
}

// [3] Register the custom shape
export const scribbleShape = [ScribbleShapeUtil]
