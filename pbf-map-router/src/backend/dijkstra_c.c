#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <float.h>
#include <math.h>
#include <stdbool.h>

// Graph edge structure
typedef struct Edge {
    int to;
    double dist;
    struct Edge* next;
} Edge;

// Graph node structure
typedef struct Node {
    Edge* edges;
} Node;

// Priority queue structure (binary heap)
typedef struct HeapNode {
    int node;
    double distance;
} HeapNode;

typedef struct PriorityQueue {
    HeapNode* heap;
    int size;
    int capacity;
} PriorityQueue;

// Dijkstra result structure
typedef struct DijkstraResult {
    int* path;
    int path_length;
    double distance;
    int* explored;
    int explored_count;
    int iterations;
} DijkstraResult;

// Earth distance calculation
double calculate_distance(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371.0; // Earth radius in km
    double dLat = (lat2 - lat1) * M_PI / 180.0;
    double dLon = (lon2 - lon1) * M_PI / 180.0;
    double a = sin(dLat / 2) * sin(dLat / 2) +
               cos(lat1 * M_PI / 180.0) * cos(lat2 * M_PI / 180.0) *
               sin(dLon / 2) * sin(dLon / 2);
    double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
}

// Priority queue functions
PriorityQueue* create_priority_queue(int capacity) {
    PriorityQueue* pq = (PriorityQueue*)malloc(sizeof(PriorityQueue));
    pq->heap = (HeapNode*)malloc(sizeof(HeapNode) * capacity);
    pq->size = 0;
    pq->capacity = capacity;
    return pq;
}

void free_priority_queue(PriorityQueue* pq) {
    free(pq->heap);
    free(pq);
}

void heap_swap(HeapNode* a, HeapNode* b) {
    HeapNode temp = *a;
    *a = *b;
    *b = temp;
}

void heap_bubble_up(PriorityQueue* pq, int index) {
    while (index > 0) {
        int parent = (index - 1) / 2;
        if (pq->heap[index].distance >= pq->heap[parent].distance) break;
        heap_swap(&pq->heap[index], &pq->heap[parent]);
        index = parent;
    }
}

void heap_sink_down(PriorityQueue* pq, int index) {
    int length = pq->size;
    while (1) {
        int left = 2 * index + 1;
        int right = 2 * index + 2;
        int smallest = index;
        
        if (left < length && pq->heap[left].distance < pq->heap[smallest].distance)
            smallest = left;
        if (right < length && pq->heap[right].distance < pq->heap[smallest].distance)
            smallest = right;
        
        if (smallest == index) break;
        heap_swap(&pq->heap[index], &pq->heap[smallest]);
        index = smallest;
    }
}

void heap_push(PriorityQueue* pq, int node, double distance) {
    if (pq->size >= pq->capacity) return;
    pq->heap[pq->size].node = node;
    pq->heap[pq->size].distance = distance;
    heap_bubble_up(pq, pq->size);
    pq->size++;
}

int heap_pop(PriorityQueue* pq, int* node, double* distance) {
    if (pq->size == 0) return 0;
    *node = pq->heap[0].node;
    *distance = pq->heap[0].distance;
    pq->size--;
    if (pq->size > 0) {
        pq->heap[0] = pq->heap[pq->size];
        heap_sink_down(pq, 0);
    }
    return 1;
}

int heap_is_empty(PriorityQueue* pq) {
    return pq->size == 0;
}

// Main Dijkstra algorithm in C
DijkstraResult* dijkstra_path_c(Node* graph, int node_count, int start, int end, bool with_steps) {
    // Allocate result structure
    DijkstraResult* result = (DijkstraResult*)malloc(sizeof(DijkstraResult));
    result->path = NULL;
    result->path_length = 0;
    result->distance = DBL_MAX;
    result->explored = NULL;
    result->explored_count = 0;
    result->iterations = 0;
    
    // Distance and previous arrays
    double* distances = (double*)malloc(sizeof(double) * node_count);
    int* previous = (int*)malloc(sizeof(int) * node_count);
    int* visited = (int*)calloc(node_count, sizeof(int));
    
    // Initialize
    for (int i = 0; i < node_count; i++) {
        distances[i] = DBL_MAX;
        previous[i] = -1;
    }
    distances[start] = 0.0;
    
    // Create priority queue
    PriorityQueue* pq = create_priority_queue(node_count * 2);
    heap_push(pq, start, 0.0);
    
    // Track explored nodes for animation (if requested)
    int explored_capacity = with_steps ? 10000 : 0;
    int* explored_nodes = NULL;
    double* explored_distances = NULL;
    if (with_steps) {
        explored_nodes = (int*)malloc(sizeof(int) * explored_capacity);
        explored_distances = (double*)malloc(sizeof(double) * explored_capacity);
    }
    
    bool destination_found = false;
    int iterations = 0;
    
    // Main loop
    while (!heap_is_empty(pq)) {
        int current;
        double current_dist;
        if (!heap_pop(pq, &current, &current_dist)) break;
        
        if (visited[current]) continue;
        visited[current] = 1;
        iterations++;
        
        // Track explored node
        if (with_steps && result->explored_count < explored_capacity) {
            explored_nodes[result->explored_count] = current;
            explored_distances[result->explored_count] = current_dist;
            result->explored_count++;
        }
        
        if (current == end) {
            destination_found = true;
            break;
        }
        
        // Explore neighbors
        Edge* edge = graph[current].edges;
        while (edge) {
            double alt = current_dist + edge->dist;
            if (alt < distances[edge->to]) {
                distances[edge->to] = alt;
                previous[edge->to] = current;
                heap_push(pq, edge->to, alt);
            }
            edge = edge->next;
        }
    }
    
    // Build path if found
    if (destination_found && distances[end] != DBL_MAX) {
        result->distance = distances[end];
        
        // Count path length
        int path_len = 0;
        int current = end;
        while (current != -1) {
            path_len++;
            current = previous[current];
        }
        
        // Build path array
        result->path = (int*)malloc(sizeof(int) * path_len);
        result->path_length = path_len;
        
        current = end;
        for (int i = path_len - 1; i >= 0; i--) {
            result->path[i] = current;
            current = previous[current];
        }
    }
    
    result->iterations = iterations;
    
    // Copy explored data to result
    if (with_steps && result->explored_count > 0) {
        result->explored = (int*)malloc(sizeof(int) * result->explored_count);
        for (int i = 0; i < result->explored_count; i++) {
            result->explored[i] = explored_nodes[i];
        }
    }
    
    // Cleanup
    free_priority_queue(pq);
    free(distances);
    free(previous);
    free(visited);
    if (explored_nodes) free(explored_nodes);
    if (explored_distances) free(explored_distances);
    
    return result;
}

void free_dijkstra_result(DijkstraResult* result) {
    if (result) {
        if (result->path) free(result->path);
        if (result->explored) free(result->explored);
        free(result);
    }
}

void free_graph(Node* graph, int node_count) {
    for (int i = 0; i < node_count; i++) {
        Edge* edge = graph[i].edges;
        while (edge) {
            Edge* next = edge->next;
            free(edge);
            edge = next;
        }
    }
    free(graph);
}

// Parse JSON graph from stdin
Node* parse_graph_from_json(int* node_count) {
    char buffer[10000000]; // 10MB buffer
    int pos = 0;
    
    // Read entire stdin
    while (fgets(buffer + pos, sizeof(buffer) - pos, stdin)) {
        pos += strlen(buffer + pos);
    }
    buffer[pos] = '\0';
    
    // Simple JSON parsing - find node count
    *node_count = 0;
    char* ptr = buffer;
    while (*ptr) {
        if (*ptr == ':') (*node_count)++;
        ptr++;
    }
    
    Node* graph = (Node*)calloc(*node_count, sizeof(Node));
    
    // Parse edges (simplified - assumes specific JSON format)
    ptr = buffer;
    int current_node = 0;
    
    while (*ptr) {
        // Skip to node data
        while (*ptr && *ptr != '[') ptr++;
        if (!*ptr) break;
        ptr++; // skip '['
        
        // Parse edges for this node
        while (*ptr && *ptr != ']') {
            // Skip to edge object
            while (*ptr && *ptr != '{') ptr++;
            if (!*ptr) break;
            ptr++; // skip '{'
            
            // Parse "to" value
            while (*ptr && strncmp(ptr, "\"to\":", 5) != 0) ptr++;
            if (!*ptr) break;
            ptr += 5; // skip "to":
            
            int to = 0;
            while (*ptr && (*ptr < '0' || *ptr > '9')) ptr++;
            while (*ptr && *ptr >= '0' && *ptr <= '9') {
                to = to * 10 + (*ptr - '0');
                ptr++;
            }
            
            // Parse "dist" value
            while (*ptr && strncmp(ptr, "\"dist\":", 7) != 0) ptr++;
            if (!*ptr) break;
            ptr += 7; // skip "dist":
            
            double dist = 0.0;
            while (*ptr && (*ptr < '0' || *ptr > '9') && *ptr != '.') ptr++;
            bool decimal = false;
            double divisor = 1.0;
            while (*ptr && ((*ptr >= '0' && *ptr <= '9') || *ptr == '.')) {
                if (*ptr == '.') {
                    decimal = true;
                } else if (!decimal) {
                    dist = dist * 10 + (*ptr - '0');
                } else {
                    divisor *= 10.0;
                    dist = dist + (*ptr - '0') / divisor;
                }
                ptr++;
            }
            
            // Add edge to graph
            Edge* edge = (Edge*)malloc(sizeof(Edge));
            edge->to = to;
            edge->dist = dist;
            edge->next = graph[current_node].edges;
            graph[current_node].edges = edge;
            
            // Skip to next edge
            while (*ptr && *ptr != '}') ptr++;
            if (*ptr) ptr++; // skip '}'
            while (*ptr && (*ptr == ',' || *ptr == ' ' || *ptr == '\n')) ptr++;
        }
        
        current_node++;
        if (current_node >= *node_count) break;
    }
    
    return graph;
}

// Output result as JSON
void output_result_json(DijkstraResult* result) {
    printf("{\"path\":[");
    if (result->path && result->path_length > 0) {
        for (int i = 0; i < result->path_length; i++) {
            if (i > 0) printf(",");
            printf("%d", result->path[i]);
        }
    }
    printf("],\"distance\":%.6f,\"iterations\":%d,\"explored\":[", 
           result->distance, result->iterations);
    
    if (result->explored && result->explored_count > 0) {
        for (int i = 0; i < result->explored_count; i++) {
            if (i > 0) printf(",");
            printf("%d", result->explored[i]);
        }
    }
    printf("]}");
}

int main(int argc, char* argv[]) {
    if (argc != 4) {
        fprintf(stderr, "Usage: %s <start_node> <end_node> <with_steps>\n", argv[0]);
        return 1;
    }
    
    int start = atoi(argv[1]);
    int end = atoi(argv[2]);
    bool with_steps = (atoi(argv[3]) != 0);
    
    int node_count;
    Node* graph = parse_graph_from_json(&node_count);
    
    if (!graph) {
        fprintf(stderr, "Failed to parse graph\n");
        return 1;
    }
    
    DijkstraResult* result = dijkstra_path_c(graph, node_count, start, end, with_steps);
    
    output_result_json(result);
    
    free_dijkstra_result(result);
    free_graph(graph, node_count);
    
    return 0;
}
